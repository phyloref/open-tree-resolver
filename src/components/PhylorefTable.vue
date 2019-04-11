<template>
  <table class="table table-hover table-flush mb-0">
    <thead>
      <th width="15%">Name</th>
      <th width="40%">Description</th>
      <th>Specifiers</th>
    </thead>
    <tbody>
      <tr
        v-if="phylorefs.length === 0"
        class="bg-white"
      >
        <td colspan="3">
          <center><em>No phyloreferences loaded</em></center>
        </td>
      </tr>
      <template v-for="(phyloref, phylorefIndex) of phylorefs">
        <template v-if="getSpecifiersForPhyloref(phyloref).length === 0">
          <tr :key="'phyloref_' + phylorefIndex">
            <td>
              {{ phyloref.label || `Phyloref ${phylorefIndex + 1}` }}
            </td>
            <td>
              <span v-html="getPhylorefDescription(phyloref)"></span>
            </td>
            <td>
              <center><em>No specifiers provided.</em></center>
            </td>
          </tr>
        </template>
        <template v-else>
          <template v-for="(specifier, specifierIndex) of getSpecifiersForPhyloref(phyloref)">
            <tr  :key="'phyloref_' + phylorefIndex + '_specifier_' + specifierIndex">
              <template v-if="specifierIndex === 0">
                <td :rowspan="getSpecifiersForPhyloref(phyloref).length">
                  {{ phyloref.label || `Phyloref ${phylorefIndex + 1}` }}
                </td>
                <td :rowspan="getSpecifiersForPhyloref(phyloref).length">
                  <span v-html="getPhylorefDescription(phyloref)"></span>
                </td>
              </template>
              <td>
                {{getSpecifierType(phyloref, specifier)}}
                <span v-html="getLabelForSpecifierAsHTML(specifier)"></span>
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

    <div class="card border-dark mt-2">
      <h5 class="card-header border-dark">
        Phylogeny
      </h5>
      <div class="card-body">
        <form>
          <div class="form-group row">
            <label
              for="newick"
              class="col-md-2 control-label"
            >
              Newick
            </label>
            <div class="col-md-10 input-group">
              <textarea
                v-model.lazy="newick"
                rows="3"
                class="form-control"
                placeholder="Enter Newick string for phylogeny here"
              />
            </div>
          </div>
        </form>
      </div>
      <div class="card-footer">
        <div class="btn-group" role="group" area-label="Look up trees on the Open Tree of Life">
          <button
            class="btn btn-primary"
            href="javascript:;"
            :click="downloadInducedSubtreeFromOpenTreeOfLife(ottIdsForAllSpecifiers)"
          >
            Download induced subtree from the Open Tree of Life
          </button>
        </div>
      </div>
    </div>

    <!-- Display the phylogeny (unless there were Newick parsing errors) -->
    <div
      class="card border-dark mt-2"
    >
      <h5 class="card-header">
        Phylogeny
      </h5>
      <div class="card-body">
        <Phylotree
          :newick="newick"
        />
      </div>
    </div>

  </div>
</template>

<script>
/*
 * A table for displaying information about loaded phyloreferences. Specifically,
 * this includes:
 *  - Phyloreference name
 *  - Clade definition
 *  - List of specifiers
 */

import { PhylorefWrapper } from '@phyloref/phyx';

export default {
  name: 'PhylorefTable',
  components: {
    Phylotree,
  },
  props: {
    phylorefs: {
      type: Array,
      default: () => { return []; }
    },
  },
  data: function () {
    // Local variables for this component.
    return {
      flagDisplayExpression: false,
      loadedPhylorefs: [],
      openTreeTaxonomyInfoByName: {},
      newick: '()',
      PHYX_CONTEXT_JSON: "http://www.phyloref.org/phyx.js/context/v0.1.0/phyx.json",
      ONTOLOGY_BASEURI: "http://example.org/#",
      reasoningInProgress: false,
      reasoningResults: {},
      currentNodes: {}
    };
  },
  computed: {
    allSpecifiers() {
      return this.loadedPhylorefs.map(phyloref => this.getSpecifiersForPhyloref(phyloref)).reduce((acc, val) => acc.concat(val), []);
    },
    phylorefsWithMoreThanOneSpecifier() {
      return this.loadedPhylorefs.filter(phyloref => (this.getSpecifiersForPhyloref(phyloref) || []).length > 1);
    },
    ottIdsForAllSpecifiers() {
      // Assumes that queryOpenTreeTaxonomyIDs has already been called!
      const ottIds = this.allSpecifiers.map(specifier => this.getOpenTreeTaxonomyID(specifier))
        .filter(x => x !== undefined && x !== null);
      return ottIds;
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
    /*
     * Phyloref and specifier getters (should be moved into phyx.js)
     */

    getPhylorefDescription(phyloref) {
      // Returns the clade definition of a particular phyloreference. Supports both
      // Phyx and Model 2.0 JSON-LD descriptions. Will return 'None' if none could
      // be found.
      const description = phyloref.cladeDefinition || phyloref['obo:IAO_0000115'] || 'None';

      // If there are '\n's in the text, replace them with <br />.
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

    getLabelForSpecifierAsHTML(specifier) {
      // Return a string describing this specifier with HTML elements to format
      // particular elements, such as italicizing the scientific name.
      const label = PhylorefWrapper.getSpecifierLabel(specifier);
      if(label.startsWith("Specimen")) return label;

      return label.replace(/^\w+ [a-z-]+/, "<em>$&</em>");
    },
  }
};
</script>
