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
                  TODO Resolved node
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
  },
  computed: {
    asOntology() {
      const phylorefsWithEquivalentClass = this.loadedPhylorefs.filter(
        phyloref => has(phyloref, 'equivalentClass')
      );
      // Add the phylogeny.
      const phylogenyNodes = new PhylogenyWrapper({
        newick: this.newick,
      }).getNodesAsJSONLD(this.ONTOLOGY_BASEURI + 'phylogeny');
      const phylorefsByLabel = {};
      phylorefsWithEquivalentClass.forEach(phyloref => {
        if(has(phyloref, 'label')) {
          if(!has(phyloref, '@id')) {
            // TODO: make up an '@id'.
          }
          phylorefsByLabel[phyloref.label] = phyloref;
        }
      });
      // Modify nodes to support Model 2.0 taxonomic units.
      this.currentNodes = {};
      phylogenyNodes.forEach(nodeAsParam => {
        const node = nodeAsParam;
        // Set a context.
        node['@context'] = this.PHYX_CONTEXT_JSON;
        // Make sure this node has a '@type'.
        if (!has(node, '@type')) node['@type'] = [];
        if (!Array.isArray(node['@type'])) node['@type'] = [node['@type']];
        // We replace "parent" with "obo:CDAO_0000179" so we get has_Parent
        // relationships in our output ontology.
        // To be fixed in https://github.com/phyloref/phyx.js/issues/10
        if (has(node, 'parent')) node['obo:CDAO_0000179'] = { '@id': node.parent };
        // For every internal node in this phylogeny, check to see if it's expected to
        // resolve to a phylogeny we know about. If so, add an rdf:type to that effect.
        let expectedToResolveTo = node.labels || [];
        // Are there any phyloreferences expected to resolve here?
        if (has(node, 'expectedPhyloreferenceNamed')) {
          expectedToResolveTo = expectedToResolveTo.concat(node.expectedPhyloreferenceNamed);
        }
        expectedToResolveTo.forEach((phylorefLabel) => {
          if (!has(phylorefsByLabel, phylorefLabel)) return;
          // This node is expected to match phylorefLabel, which is a phyloreference we know about.
          const phylorefId = phylorefsByLabel[phylorefLabel]['@id'];
          node['@type'].push({
            '@type': 'owl:Restriction',
            onProperty: 'obo:OBI_0000312', // obi:is_specified_output_of
            someValuesFrom: {
              '@type': 'owl:Class',
              intersectionOf: [
                { '@id': 'obo:OBI_0302910' }, // obi:prediction
                {
                  '@type': 'owl:Restriction',
                  onProperty: 'obo:OBI_0000293', // obi:has_specified_input
                  someValuesFrom: { '@id': phylorefId },
                },
              ],
            },
          });
        });
        // Does this node have taxonomic units? If so, convert them into class expressions.
        if (has(node, 'representsTaxonomicUnits')) {
          node.representsTaxonomicUnits.forEach((tunit) => {
            this.convertTUtoRestriction(tunit).forEach((restriction) => {
              node['@type'].push({
                '@type': 'owl:Restriction',
                onProperty: 'obo:CDAO_0000187',
                someValuesFrom: restriction,
              });
            });
          });
        }
        // Now, rdfpipe can handle '@type's that contain restrictions,
        // but OWLAPI can't. So let's translate all '@type's into
        // 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'.
        node['http://www.w3.org/1999/02/22-rdf-syntax-ns#type'] = node['@type']
          .map(c => isString(c) ? { '@id': c } : c);
        delete node['@type'];
        // Store for later lookups.
        this.currentNodes[node['@id']] = node;
      });
      // Finally, add a header for this ontology.
      let ontologyHeader = [
        {
          '@context': this.PHYX_CONTEXT_JSON,
          '@id': this.ONTOLOGY_BASEURI,
          '@type': 'owl:Ontology',
          'owl:imports': [
            'http://raw.githubusercontent.com/phyloref/curation-workflow/develop/ontologies/phyloref_testcase.owl',
            'http://ontology.phyloref.org/2018-12-14/phyloref.owl',
            'http://ontology.phyloref.org/2018-12-14/tcan.owl',
          ],
        },
      ];
      return JSON.stringify(ontologyHeader.concat(phylorefsWithEquivalentClass).concat(phylogenyNodes), null, 4);
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
    convertTUtoRestriction(tunit) {
      // If we're called with a specifier, use the first TU in that specifier (for now).
      if (has(tunit, 'referencesTaxonomicUnits')) {
        return this.convertTUtoRestriction(tunit.referencesTaxonomicUnits[0] || {});
      }
      // Build up a series of taxonomic units from scientific names and specimens.
      const results = [];
      if (has(tunit, 'scientificNames')) {
        tunit.scientificNames.forEach((sciname) => {
          const wrappedSciname = new ScientificNameWrapper(sciname);
          results.push({
            '@type': 'owl:Restriction',
            onProperty: 'http://rs.tdwg.org/ontology/voc/TaxonConcept#hasName',
            someValuesFrom: {
              '@type': 'owl:Class',
              intersectionOf: [
                {
                  // TODO: replace with a check once we close https://github.com/phyloref/phyx.js/issues/5.
                  // For now, we pretend that all names are ICZN names.
                  '@id': 'obo:NOMEN_0000107',
                },
                {
                  '@type': 'owl:Restriction',
                  onProperty: 'dwc:scientificName',
                  // TODO: We really want the "canonical name" here: binomial or
                  // trinomial, but without any additional authority information.
                  // See https://github.com/phyloref/phyx.js/issues/8
                  hasValue: wrappedSciname.binomialName,
                },
              ],
            },
          });
        });
      } else if (has(tunit, 'includesSpecimens')) {
        // This is a quick-and-dirty implementation. Discussion about it should be
        // carried out in https://github.com/phyloref/clade-ontology/issues/61
        tunit.includesSpecimens.forEach((specimen) => {
          const wrappedSpecimen = new SpecimenWrapper(specimen);
          results.push({
            '@type': 'owl:Restriction',
            onProperty: 'dwc:organismID',
            hasValue: wrappedSpecimen.occurrenceID,
          });
        });
      } else {
        // Ignore it for now (but warn the user).
        console.log(`WARNING: taxonomic unit could not be converted into restriction: ${JSON.stringify(tunit)}\n`);
        results.push({});
      }
      return results;
    },

    reasonOverPhylogeny() {
      // Send JSON-LD to server for reasoning.
      // Reason over all the phyloreferences and store the results on
      // the Vue model at vm.reasoningResults so we can access them.
      // Are we already reasoning? If so, ignore.
      if (this.reasoningInProgress) return;
      // Disable "Reason" buttons so they can't be reused.
      this.reasoningInProgress = true;
      this.reasoningResults = {};

      jQuery.post('http://localhost:34214/reason', {
        // This will convert the JSON-LD file into an application/x-www-form-urlencoded
        // string (see https://api.jquery.com/jquery.ajax/#jQuery-ajax-settings under
        // processData for details). The POST data sent to the server will look like:
        //  jsonld=%7B%5B%7B%22title%22%3A...
        // which translates to:
        //  jsonld={[{"title":...
        jsonld: this.asOntology,
      }).done((data) => {
        this.reasoningResults = data.phylorefs;
        // console.log('Data retrieved: ', data);
      }).fail((jqXHR, textStatus, errorThrown) => {
        // We can try using the third argument, but it appears to be the
        // HTTP status (e.g. 'Internal Server Error'). So we default to that,
        // but look for a better one in the JSON response from the server, if
        // available.
        let error = errorThrown;
        if (has(jqXHR, 'responseJSON') && has(jqXHR.responseJSON, 'error')) {
          error = jqXHR.responseJSON.error;
        }
        if (error === undefined || error === '') error = 'unknown error';
        alert(`Error occurred on server while reasoning: ${error}`);
      }).always(() => {
        // Reset "Reasoning" buttons to their usual state.
        this.reasoningInProgress = false;
      });
    },

    getOTTNodeId(node) {
      const labels = node.labels || [];
      if(labels.length == 0) return undefined;
      const label = labels[0]; // Ignore other labels.
      const match = /^(.*)[_\s](.*?ott.*)$/.exec(label);
      if(match == null) {
          const matchMRCA = /^mrca.*$/.exec(label);
          if(matchMRCA == null) return undefined;
          return ["", label];
      }
      return [match[1], match[2]];
    },

    downloadInducedSubtreeFromOpenTreeOfLife(ottIds) {
      if(ottIds.length === 0) return;
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
