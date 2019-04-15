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
            <tr :key="phylorefIndex"><!-- This :key only works since users can't reorder the phylorefs -->
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
          href="javascript:;"
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
      <div class="btn-group ml-2" role="group" area-label="Actions on phyloreferences">
        <button class="btn btn-danger" type="button" @click="loadedPhylorefs = []">
          Clear phylorefs
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

import { has, isEqual } from 'lodash';
import jQuery from 'jquery';
import { PhylorefWrapper } from '@phyloref/phyx';

export default {
  name: 'PhylorefTable',
  data: function () {
    // Local variables for this component.
    return {
      flagDisplayExpression: false,
      loadedPhylorefs: [],
      openTreeTaxonomyInfoByName: {},
    };
  },
  computed: {
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
      // Returns the clade definition of a particular phyloreference. Supports both
      // Phyx and Model 2.0 JSON-LD descriptions. Will return 'None' if none could
      // be found.
      const description = phyloref.cladeDefinition || phyloref['obo:IAO_0000115'] || 'None';

      // If there are '\n's in the text, replace them with <br>.
      return description.replace(/\n+/g, "<br />");
    },

    getSpecifierType(phyloref, specifier) {
      // Get the type of a particular specifier, which means looking up which
      // field it is in. Will return one of the following strings: "includes",
      // "excludes" or "unknown".
      if((phyloref.internalSpecifiers || []).indexOf(specifier) !== -1) return "includes";
      if((phyloref.externalSpecifiers || []).indexOf(specifier) !== -1) return "excludes";
      return "unknown";
    },

    getSpecifiersForPhyloref(phyloref) {
      // Return a list of all specifiers for a particular phyloreference.
      // Is guaranteed to return a list (even if it's an empty list).
      const specifiers = phyloref.internalSpecifiers || [];
      return specifiers.concat(phyloref.externalSpecifiers || []);
    },

    getLabelForSpecifier(specifier) {
      // Return a string describing this specifier.
      return PhylorefWrapper.getSpecifierLabel(specifier);
    },

    getLabelForSpecifierAsHTML(specifier) {
      // Return a string describing this specifier with HTML elements to format
      // particular elements, such as italicizing the scientific name.
      const label = PhylorefWrapper.getSpecifierLabel(specifier);
      if(label.startsWith("Specimen")) return label;

      return label.replace(/^\w+ [\w\\-]+/, "<em>$&</em>");
    },

    loadJSONLDFromURL(url) {
      // Load phylorefs from a JSON-LD file from a particular url.
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
      // Load phylorefs from one or more JSON-LD files from the local file system
      // using FileReader. fileInput needs to be an HTML element representing an
      // <input type="file"> in which the user has selected the local file(s)
      // they wish to load.
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
      // Add a new phyloref to the list of loadedPhylorefs. We use isEqual
      // to prevent adding the same phyloreference more than once, but we will
      // add different phyloreferences with the same '@id'.
      if(this.loadedPhylorefs.find(phy => isEqual(phy, phyloref)) !== undefined) return;

      // No previous match? Then add it in!
      this.loadedPhylorefs.push(phyloref);
    },

    extractPhyloreferencesFromJSONLD(jsonld) {
      // Extract phyloreferences from the provided JSON-LD representation.

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
        // This entry might have multiple subclasses. If one of them is phyloref:Phyloreference,
        // add it as a phyloreference.
        if(Array.isArray(jsonld.subClassOf) && jsonld.subClassOf.includes('phyloref:Phyloreference'))
          this.addPhyloref(jsonld);

        // If this entry has a single subclass that is phyloref:Phyloreference,
        // add it as a phyloreference.
        if(jsonld.subClassOf === 'phyloref:Phyloreference')
          this.addPhyloref(jsonld);
      }
    },
  }
};
</script>
