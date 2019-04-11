<template>
  <div class="card border-dark">
    <h5 class="card-header border-dark">
      Phyloreferences
    </h5>
    <div class="card-body p-0">
      <table class="table table-hover table-flush">
        <thead>
          <th width="15%">Name</th>
          <th width="40%">Description</th>
          <th>Specifiers</th>
          <th>Open Tree Taxonomy ID</th>
        </thead>
        <tbody>
          <tr
            v-if="loadedPhylorefs.length === 0"
            class="bg-white"
          >
            <td colspan="4">
              <center><em>No phyloreferences loaded</em></center>
            </td>
          </tr>
          <template v-for="(phyloref, phylorefIndex) of loadedPhylorefs">
            <tr :key="phylorefIndex"><!-- This :key only works as long as users can't reorder the phylorefs -->
              <td :rowspan="getSpecifiersForPhyloref(phyloref).length + 1">
                {{ phyloref.label || `Phyloref ${phylorefIndex + 1}` }}
              </td>
              <td :rowspan="getSpecifiersForPhyloref(phyloref).length + 1">
                <span v-html="getPhylorefDescription(phyloref)"></span>
              </td>
            </tr>
            <template v-for="specifier of getSpecifiersForPhyloref(phyloref)">
              <tr :key="'phyloref' + phylorefIndex + ', specifier: ' + getLabelForSpecifier(specifier)">
                <td>{{getSpecifierType(phyloref, specifier)}} <span v-html="getLabelForSpecifierAsHTML(specifier)"></span></td>
                <td>
                  <template v-if="getOpenTreeTaxonomyID(specifier)">
                    <a target="_blank" :href="'https://tree.opentreeoflife.org/opentree/@ott' + getOpenTreeTaxonomyID(specifier)">{{getOpenTreeTaxonomyID(specifier)}}</a>
                    (<a target="_blank" :href="'https://tree.opentreeoflife.org/taxonomy/browse?id=' + getOpenTreeTaxonomyID(specifier)">ott</a>)
                  </template>
                </td>
              </tr>
            </template>
          </template>
        </tbody>
      </table>
    </div>
    <div class="card-footer">
      <div class="btn-group" role="group" area-label="Add phyloreferences">
        <button
          class="btn btn-primary"
          href="javascript: void(0)"
          onclick="$('#load-jsonld').trigger('click')"
        >
          Add phyloreferences from JSON-LD file
        </button>
        <input
          id="load-jsonld"
          type="file"
          multiple="true"
          class="d-none"
          @change="loadJSONLDFromFileInputById('#load-jsonld')"
        >
        <button class="btn btn-secondary dropdown-toggle" type="button" id="addFromExamples" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
          Add phyloreferences from example
        </button>
        <div class="dropdown-menu" aria-labelledby="addFromExamples">
          <a href="javascript:;" class="dropdown-item" v-for="example of exampleJSONLDURLs" v-bind:key="example.url" @click="loadJSONLDFromURL(example.url)">
            {{example.title}}
          </a>
        </div>
      </div>
      <div class="btn-group ml-2" role="group" area-label="Edit phyloreference list">
        <button class="btn btn-danger" type="button" @click="loadedPhylorefs = []">
          Clear phylorefs
        </button>
      </div>
      <div class="btn-group ml-2" role="group" area-label="Open Tree Taxonomy tasks">
        <button class="btn btn-primary" type="button" @click="queryOpenTreeTaxonomyIDs()">
          Query specifiers against Open Tree of Life Taxonomy
        </button>
      </div>
    </div>
  </div>
</template>

<script>
/*
 * A modal for displaying information about loaded phyloreferences,
 * and the ability to add new phyloreferences.
 */

import { has, isEqual, uniq, chunk } from 'lodash';
import Vue from 'vue';
import jQuery from 'jquery';
import { PhylorefWrapper } from '@phyloref/phyx';

export default {
  name: 'PhylorefTable',
  data: function () {
    return {
      flagDisplayExpression: false,
      loadedPhylorefs: [],
      openTreeTaxonomyInfoByName: {},
    };
  },
  computed: {
    allSpecifiers() {
      return this.loadedPhylorefs.map(phyloref => this.getSpecifiersForPhyloref(phyloref)).reduce((acc, val) => acc.concat(val), []);
    },
    phylorefsWithMoreThanOneSpecifier() {
      return this.loadedPhylorefs.filter(phyloref => (this.getSpecifiersForPhyloref(phyloref) || []).length > 1);
    },
    exampleJSONLDURLs() { return [
      // Returns a list of example files to display in the "Examples" menu.
      {
        url: 'examples/fisher_et_al_2007.jsonld',
        title: 'Fisher et al, 2007',
      },
      {
        url: 'examples/hillis_and_wilcox_2005.jsonld',
        title: 'Hillis and Wilcox, 2005',
      },
      {
        url: 'examples/brochu_2003.jsonld',
        title: 'Brochu 2003',
      },
    ]}
  },
  methods: {
    getPhylorefDescription(phyloref) {
      const description = phyloref.cladeDefinition || phyloref['obo:IAO_0000115'] || 'None';

      // If there are '\n's in the text, replace them with <br>.
      return description.replace(/\n+/g, "<br />");
    },

    getOpenTreeTaxonomyID(specifier) {
      const matches = this.openTreeTaxonomyInfoByName[this.getScinameForSpecifier(specifier)];
      if(matches && matches.length > 0) {
        return matches[0]['taxon']['ott_id'];
      }
    },

    queryOpenTreeTaxonomyIDs() {
      // Calculate names from currently loaded specifiers.
      const names = this.allSpecifiers.map(specifier => this.getScinameForSpecifier(specifier));
      this.queryOpenTreeTaxonomyIDsForNames({names});
    },

    setOpenTreeTaxonomyInfoByNames(results) {
      results.forEach(info => {
        if(has(info, 'name') && info.name && has(info, 'matches') && info.matches && info.matches.length > 0) {
          const name = info.name.trim();
          // console.log("Setting", name, "to", info['matches']);
          // Do we have any flags? If so, ignore this.
          const flags = info.matches[0].taxon.flags || [];
          // TODO do something cleverer when choosing between multiple matches
          Vue.set(this.openTreeTaxonomyInfoByName, name, info['matches'] || []);
        }
      });
    },

    queryOpenTreeTaxonomyIDsForNames(options) {
      // Creates queries to the Open Tree Taxonomy for the provided names.
      // This will return asynchonously; you need to call getOpenTreeTaxonomyID(name)
      // to retrieve the results.
      // Options can be anything from https://github.com/OpenTreeOfLife/germinator/wiki/TNRS-API-v3#match_names, including:
      //  - context_name:
      //  - do_approximate_matching
      // Deduplicate names to be queried.
      const names = uniq(options.names)
        .filter(name => name !== undefined && name !== null) // Eliminate any undefineds or nulls.
        .sort();
      // Step 1. Delete existing entries for the provided names.
      this.setOpenTreeTaxonomyInfoByNames(names.map(name => {
        return {
          name,
          matches: [],
        };
      }));
      // OToL TNRS match_names has a limit of 1,000 names.
      chunk(names, 999).forEach(chunk => {
        options.names = chunk;
        const data = JSON.stringify(options);
        // Step 2. Spawn queries to OTT asking for the names.
        jQuery.ajax({
          type: 'POST',
          url: 'https://api.opentreeoflife.org/v3/tnrs/match_names',
          data,
          contentType: 'application/json; charset=utf-8',
          dataType: 'json',
          success: (data) => {
            this.setOpenTreeTaxonomyInfoByNames(data.results);
          },
        })
          .fail(x => console.log("Error accessing Open Tree Taxonomy", x));
      });
    },

    getSpecifierType(phyloref, specifier) {
      if((phyloref.internalSpecifiers || []).indexOf(specifier) !== -1) return "includes";
      if((phyloref.externalSpecifiers || []).indexOf(specifier) !== -1) return "excludes";
      return "unknown";
    },

    getSpecifiersForPhyloref(phyloref) {
      const specifiers = phyloref.internalSpecifiers || [];
      return specifiers.concat(phyloref.externalSpecifiers || []);
    },

    getLabelForSpecifier(specifier) {
      return PhylorefWrapper.getSpecifierLabel(specifier);
    },

    getLabelForSpecifierAsHTML(specifier) {
      const label = PhylorefWrapper.getSpecifierLabel(specifier);
      if(label.startsWith("Specimen")) return label;

      return label.replace(/^\w+ [a-z\-]+/, "<em>$&</em>");
    },

    getScinameForSpecifier(specifier) {
      const label = PhylorefWrapper.getSpecifierLabel(specifier);
      if(label.startsWith("Specimen")) return undefined;
      const matches = label.match(/^\w+ [a-z\-]+/);
      if(matches) return matches[0];
      return undefined;
    },

    loadJSONLDFromURL(url) {
      // Change the current PHYX to that in the provided URL.
      // Will ask the user to confirm before replacing it.

      jQuery.getJSON(url)
        .done((data) => {
          this.extractPhyloreferencesFromJSONLD(data);
        })
        .fail((error) => {
          if (error.status === 200) {
            alert(`Could not load JSON-LD file '${url}': file malformed, see console for details.`);
          } else {
            alert(`Could not load JSON-LD file '${url}': server error ${error.status} ${error.statusText} from ${JSON.stringify(error)}`);
          }
        });
    },

    loadJSONLDFromFileInputById(fileInputId) {
      //
      // Load a JSON file from the local file system using FileReader. fileInput
      // needs to be an HTML element representing an <input type="file"> in which
      // the user has selected the local file they wish to load.
      //
      // This code is based on https://stackoverflow.com/a/21446426/27310

      if (typeof window.FileReader !== 'function') {
        alert('The FileReader API is not supported on this browser.');
        return;
      }

      const $fileInput = jQuery(fileInputId);
      if (!$fileInput) {
        alert('Programmer error: No file input element specified.');
        return;
      }

      if (!$fileInput.prop('files')) {
        alert('File input element found, but files property missing: try another browser?');
        return;
      }

      const files = $fileInput.prop('files');
      if (files.length === 0) {
        alert('Please select a file before attempting to load it.');
        return;
      }

      for(let x = 0; x < files.length; x++) {
        const file = files.item(x);
        const fr = new FileReader();
        fr.onload = ((e) => {
          const lines = e.target.result;
          const jsonld = JSON.parse(lines);

          this.extractPhyloreferencesFromJSONLD(jsonld);
        });
        fr.readAsText(file);
      }
    },

    addPhyloref(phyloref) {
      // Check to make sure this phyloref hasn't already been added.
      if(this.loadedPhylorefs.find(phy => isEqual(phy, phyloref)) !== undefined) return;

      // No previous match? Then add it in!
      this.loadedPhylorefs.push(phyloref);
    },

    extractPhyloreferencesFromJSONLD(jsonld) {
      // Extract phyloreferences from the provided JSONLD file and add them to
      // state.loaded. We use isEqual to prevent adding the same phyloreference
      // more than once, but we will add different phyloreferences with the
      // same '@id'.

      // JSON-LD files sometimes contain an array of elements. In this case,
      // we should try adding every one.
      if(Array.isArray(jsonld)) {
        jsonld.forEach(element => this.extractPhyloreferencesFromJSONLD(element));
      }

      // If this was generated by the Authoring Tool, then we can find phyloreferences
      // just by looking for jsonld.phylorefs.
      if(has(jsonld, 'phylorefs') && Array.isArray(jsonld.phylorefs)) {
        jsonld.phylorefs.forEach(phy => this.addPhyloref(phy));
      }

      // If it was created by phyx2ontology, the phyloreferences can be recognized
      // has having a subClassOf 'phyloref:Phyloreference'. Let's look for that.
      if(has(jsonld, 'subClassOf')) {
        if(Array.isArray(jsonld.subClassOf) && jsonld.subClassOf.includes('phyloref:Phyloreference'))
          this.addPhyloref(jsonld);
        if(jsonld.subClassOf === 'phyloref:Phyloreference')
          this.addPhyloref(jsonld);
      }
    },
  }
};
</script>
