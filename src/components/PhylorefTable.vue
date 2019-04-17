<template>
  <table class="table table-hover table-flush mb-0">
    <thead>
      <th width="15%">Name</th>
      <th width="40%">Description</th>
      <th>Resolved Open Tree node</th>
      <th>Specifiers</th>
      <th>Open Tree Taxonomy ID</th>
    </thead>
    <tbody>
      <tr
        v-if="phylorefs.length === 0"
        class="bg-white"
      >
        <td colspan="5">
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
            <td>&nbsp;</td>
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
                <td :rowspan="getSpecifiersForPhyloref(phyloref).length">
                  <a :href="getURLForOpenTreeResolvedNode(phyloref)">{{getLabelForOpenTreeResolvedNode(phyloref)}}</a>
                </td>
              </template>
              <td>
                {{getSpecifierType(phyloref, specifier)}}
                <span v-html="getLabelForSpecifierAsHTML(specifier)"></span>
              </td>
              <td>
                <template v-if="getOTTId(specifier)">
                  <a
                    target="_blank"
                    :href="'https://tree.opentreeoflife.org/opentree/@ott' + getOTTId(specifier)"
                  >{{getOTTId(specifier)}}</a>
                  (<a
                    target="_blank"
                    :href="'https://tree.opentreeoflife.org/taxonomy/browse?id=' + getOTTId(specifier)"
                  >ott</a>)
                </template>
              </td>
            </tr>
          </template>
        </template>
      </template>
    </tbody>
  </table>
</template>

<script>
/*
 * A table for displaying information about phyloreferences. It displays the following information:
 *  - Phyloref label
 *  - Clade definition
 *  - Specifier
 *  - Open Tree Taxonomy ID
 */

import { has } from 'lodash';
import { PhylorefWrapper } from '@phyloref/phyx';

export default {
  name: 'PhylorefTable',
  props: {
    phylorefs: {
      type: Array,
      default: () => { return []; },
    },
    ottInfoBySpecifierLabel: {
      type: Object,
      default: () => { return {}; },
    },
    reasoningResults: {
      type: Object,
      default: () => { return {}; },
    },
    nodesByID: {
      type: Object,
      default: () => { return {}; },
    },
  },
  methods: {

    /* Methods for accessing Open Tree resolved nodes */

    getURLForOpenTreeResolvedNode(phyloref) {
      // Return the URL for the Open Tree resolved node for a particular phyloreference.

      const phylorefId = phyloref['@id'];
      if(phylorefId && has(this.reasoningResults, phylorefId)) {
        const node = this.nodesByID[this.reasoningResults[phylorefId][0]];
        if(!node) return undefined;

        const label = this.getNodeLabel(node);
        if(!label) return undefined;

        const match = /^.*[_\s](.*?ott.*)$/.exec(label);
        if(match == null) {
            const matchMRCA = /^mrca.*$/.exec(label);
            if(matchMRCA == null) return undefined;
            return "https://tree.opentreeoflife.org/opentree/@" + matchMRCA[0];
        }
        return "https://tree.opentreeoflife.org/opentree/@" + match[1];
      }
      return undefined;
    },

    getLabelForOpenTreeResolvedNode(phyloref) {
      // Return the label for the Open Tree resolved node for a particular phyloreference.

      const phylorefId = phyloref['@id'];
      if(phylorefId && has(this.reasoningResults, phylorefId) && this.reasoningResults[phylorefId].length > 0) {
        const node = this.nodesByID[this.reasoningResults[phylorefId][0]];
        if(!node) return undefined;

        return this.getNodeLabel(node);
      }
      return undefined;
    },

    getNodeLabel(node) {
      // Return the label for a particular node.

      const labels = node.labels || [];
      if(labels.length == 0) return undefined;
      return labels[0]; // Ignore other labels.
    },

    /* Phyloref and specifier getters (should be moved into phyx.js) */

    getPhylorefDescription(phyloref) {
      // Returns the clade definition of a particular phyloreference. Supports both
      // Phyx and Model 2.0 JSON-LD descriptions. Will return 'None' if none could
      // be found.
      const description = phyloref.cladeDefinition || phyloref['obo:IAO_0000115'] || 'None';

      // If there are '\n's in the text, replace them with <br />.
      return description.replace(/\n+/g, "<br />");
    },

    getOTTId(specifier) {
      // Returns the Open Tree Taxonomy ID for a particular specifier.
      const matches = this.ottInfoBySpecifierLabel[
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
