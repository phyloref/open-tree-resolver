<template>
  <table class="table table-hover table-flush mb-0">
    <thead>
      <th width="15%">Name</th>
      <th width="40%">Description</th>
      <th>Specifiers</th>
      <th>Open Tree Taxonomy ID</th>
    </thead>
    <tbody>
      <tr
        v-if="phylorefs.length === 0"
        class="bg-white"
      >
        <td colspan="4">
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
            <td>&nbsp;</td>
          </tr>
        </template>
        <template v-else>
          <template v-for="(specifier, specifierIndex) of getSpecifiersForPhyloref(phyloref)">
            <tr :key="'phyloref_' + phylorefIndex + '_specifier_' + specifierIndex">
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
              <td>
                <template v-if="getOpenTreeTaxonomyID(specifier)">
                  <a
                    target="_blank"
                    :href="'https://tree.opentreeoflife.org/opentree/@ott' + getOpenTreeTaxonomyID(specifier)"
                  >{{getOpenTreeTaxonomyID(specifier)}}</a>
                  (<a
                    target="_blank"
                    :href="'https://tree.opentreeoflife.org/taxonomy/browse?id=' + getOpenTreeTaxonomyID(specifier)"
                  >ott</a>)
                </template>
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
</template>

<script>
/*
 * A table for displaying information about phyloreferences. It displays the following information:
 *  - Phyloref label
 *  - Clade definition
 *  - Specifier
 *  - Open Tree Taxonomy ID
 */

import { PhylorefWrapper } from '@phyloref/phyx';

export default {
  name: 'PhylorefTable',
  props: {
    phylorefs: {
      type: Array,
      default: () => { return []; },
    },
    openTreeTaxonomyInfoBySpecifierLabel: {
      type: Object,
      default: () => { return {}; },
    },
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
      // Returns the Open Tree Taxonomy ID for a particular specifier.
      const matches = this.openTreeTaxonomyInfoBySpecifierLabel[
        PhylorefWrapper.getSpecifierLabel(specifier)
      ];
      if(matches && matches.length > 0) {
        return matches[0]['taxon']['ott_id'];
      }
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
