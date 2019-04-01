<template>
  <div>
    <!-- Add a warning if this phylogeny has changed -->
    <div class="card border-dark mt-2">
      <h5 class="card-header">
        Phylogeny information
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
        <div class="btn-group" role="group" area-label="Redraw the phylogeny from different sources">
          <button
            class="btn btn-secondary"
            href="javascript: void(0)"
            @click="downloadInducedSubtreeFromOpenTreeOfLife(ottIds)"
          >
            Download induced subtree from the Open Tree of Life
          </button>
          <button
            class="btn btn-secondary"
            href="javascript: void(0)"
            @click="downloadMRCAFromOpenTreeOfLife(ottIds)"
          >
            Download MRCA and subtree from the Open Tree of Life
          </button>
        </div>
      </div>
    </div>

    <!-- Display the list of errors encountered when parsing this Newick string -->
    <div
      v-if="phylogenyNewickErrors.length !== 0"
      class="card border-dark mt-2"
    >
      <h5 class="card-header bg-danger">
        Errors occurred while parsing Newick string
      </h5>
      <div class="card-body">
        <template v-for="(error, errorIndex) of phylogenyNewickErrors">
          <p><strong>{{ error.title }}.</strong> {{ error.message }}</p>
        </template>
      </div>
    </div>

    <!-- Display the phylogeny (unless there were Newick parsing errors) -->
    <div
      v-if="phylogenyNewickErrors.length === 0"
      class="card border-dark mt-2"
    >
      <h5 class="card-header">
        Phylogeny visualization
      </h5>
      <div class="card-body">
        <Phylotree
          :newick="newick"
        />
      </div>
    </div>

    <div class="card border-dark mt-2">
      <h5 class="card-header border-dark">
        Reasoning over input ontologies
      </h5>
      <div class="card-body p-0">
        <textarea readonly rows="5" class="form-control" :value="asOntology"></textarea>
        <textarea readonly rows="5" class="form-control" :value="JSON.stringify(reasoningResults, null, 4)"></textarea>
      </div>
      <div class="card-footer">
        <div class="btn-group" role="group" area-label="Reason over the phylogeny">
          <button
            class="btn btn-secondary"
            href="javascript: void(0)"
            @click="reasonOverPhylogeny()"
          >
            Reason over this phylogeny<span v-if="reasoningInProgress"> (in progress)</span>
          </button>
        </div>
      </div>
    </div>

    <div class="card border-dark mt-2">
      <h5 class="card-header border-dark">
        Reasoning results (temporary)
      </h5>
      <div class="card-body p-0">
        <table class="table table-hover table-flush">
          <thead>
            <th>Label</th>
            <th>Phylogeny nodes</th>
            <th>Node labels</th>
            <th>OToL node</th>
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
                <template v-if="reasoningResults[phyloref['@id']]">
                  <template v-for="(nodeId, nodeIdIndex) of reasoningResults[phyloref['@id']]">
                  <tr>
                    <td>
                      <a href="javascript: void(0)">
                        {{ phyloref.label || `Phyloref ${phylorefIndex + 1}` }}
                      </a>
                    </td>
                    <td>
                      {{ nodeId }}
                    </td>
                    <td>
                      {{ (currentNodes[nodeId].labels || []).join(', ') }}
                    </td>
                    <td>
                      <template v-if="getOTTNodeId(currentNodes[nodeId])">
                        <a target="_blank" :href="'https://tree.opentreeoflife.org/opentree/argus/@' + getOTTNodeId(currentNodes[nodeId])[1]">{{getOTTNodeId(currentNodes[nodeId])[1]}}</a>
                      </template>
                      <template v-else>
                        Could not extract OTT node id from {{currentNodes[nodeId]}}.
                      </template>
                    </td>
                  </tr>
                  </template>
                </template>
                <template v-else>
                  <tr>
                    <td>
                      <a href="javascript: void(0)">
                        {{ phyloref.label || `Phyloref ${phylorefIndex + 1}` }}
                      </a>
                    </td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                  </tr>
                </template>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script>
/*
 * This view displays a phylogeny and changes its title or Newick string.
 */

import { has, isString } from 'lodash';
import { mapState } from 'vuex';
import { PhylogenyWrapper, ScientificNameWrapper, SpecimenWrapper } from '@phyloref/phyx';
import { parse as parseNewick } from 'newick-js';
import jQuery from 'jquery';

import Phylotree from './Phylotree.vue';

export default {
  name: 'PhylogenyView',
  components: { Phylotree },
  props: {
    initialNewick: {
      type: String,
      default: '()',
    },
    ottIds: {
      type: Array,
      default: [],
    }
  },
  data: function () { return {
    newick: this.initialNewick,
    PHYX_CONTEXT_JSON: "http://www.phyloref.org/phyx.js/context/v0.1.0/phyx.json",
    ONTOLOGY_BASEURI: "http://example.org/opentreeontology#",
    reasoningInProgress: false,
    reasoningResults: {},
    currentNodes: {}
  }},
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
    /*
     * The following properties allow you to get or set the phylogeny label,
     * description or newick string.
     */
    phylogenyNewickErrors() {
      // TODO: replace with PhylogenyWrapper.getErrorsInNewickString().

      // Given a Newick string, return a list of errors found in parsing this
      // string. The errors are returned as a list of objects, each of which
      // has two properties:
      //  - title: A short title of the error, distinct for each type of error.
      //  - message: A longer description of the error, which might include
      //    information specific to a particular error.
      //
      // We try to order errors from most helpful ('Unbalanced parentheses in
      // Newick string') to least helpful ('Error parsing phylogeny').
      if (!has(this.selectedPhylogeny, 'newick')) return [];
      const newickTrimmed = this.selectedPhylogeny.newick.trim();
      const errors = [];

      // Look for an empty Newick string.
      if (newickTrimmed === '' || newickTrimmed === '()' || newickTrimmed === '();') {
        // None of the later errors are relevant here, so bail out now.
        return [{
          title: 'No phylogeny entered',
          message: 'Click on "Edit as Newick" to enter a phylogeny below.',
        }];
      }

      // Look for an unbalanced Newick string.
      let parenLevels = 0;
      for (let x = 0; x < newickTrimmed.length; x += 1) {
        if (newickTrimmed[x] === '(') parenLevels += 1;
        if (newickTrimmed[x] === ')') parenLevels -= 1;
      }

      if (parenLevels !== 0) {
        errors.push({
          title: 'Unbalanced parentheses in Newick string',
          message: (parenLevels > 0
            ? `You have ${parenLevels} too many open parentheses`
            : `You have ${-parenLevels} too few open parentheses`
          ),
        });
      }

      // Finally, try parsing it with parseNewick and see if we get an error.
      try {
        parseNewick(newickTrimmed);
      } catch (ex) {
        errors.push({
          title: 'Error parsing phylogeny',
          message: `An error occured while parsing this phylogeny: ${ex.message}`,
        });
      }

      return errors;
    },
    ...mapState({
      currentPhyx: state => state.phyx.currentPhyx,
      loadedPhyx: state => state.phyx.loadedPhyx,
      loadedPhylorefs: state => state.phylorefs.loaded,
    }),
  },
  methods: {
    getOTTNodeId(node) {
        const labels = node.labels || [];
        if(labels.length == 0) return undefined;
        const label = labels[0]; // Ignore other labels.

        const match = /^(.*)_(.*?ott.*)$/.exec(label);
        if(match == null) {
            const matchMRCA = /^mrca.*$/.exec(label);
            if(matchMRCA == null) return undefined;
            return ["", label];
        }
        return [match[1], match[2]];
    },
    reasonOverPhylogeny() {
      // Send JSON-LD to server for reasoning.
      // Reason over all the phyloreferences and store the results on
      // the Vue model at vm.reasoningResults so we can access them.

      // Are we already reasoning? If so, ignore.
      if (this.reasoningInProgress) return;

      // Disable "Reason" buttons so they can't be reused.
      this.reasoningInProgress = true;
      $.post('http://localhost:34214/reason', {
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
    /*
      * convertTUtoRestriction(tunit)
      *  - tunit: A taxonomic unit (or a specifier containing at least one taxonomic unit)
      *
      * Converts a taxonomic unit to a list of OWL restrictions, in the form of:
      *  tc:hasName some (ICZN_Name and dwc:scientificName value "scientific name")
      * or:
      *  tc:circumscribedBy some (dwc:organismID value "occurrence ID")
      *
     * This method will be moved back into phyx.js as part of https://github.com/phyloref/phyx.js/issues/4
      */
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
    downloadInducedSubtreeFromOpenTreeOfLife(ottIds) {
      if(ottIds.length === 0) return;

      // Induced subtree approach
      jQuery.ajax({
        type: 'POST',
        url: 'https://api.opentreeoflife.org/v3/tree_of_life/induced_subtree',
        data: JSON.stringify({
          ott_ids: ottIds,
        }),
        contentType: 'application/json; charset=utf-8',
        dataType: 'json',
        success: (data) => {
          this.newick = data.newick;
        },
      })
        .fail(x => console.log("Error accessing Open Tree induced_subtree", x));
    },
    downloadMRCAFromOpenTreeOfLife(ottIds) {
      if(ottIds.length === 0) return;

      jQuery.ajax({
        type: 'POST',
        url: 'https://api.opentreeoflife.org/v3/tree_of_life/mrca',
        data: JSON.stringify({
          ott_ids: ottIds,
        }),
        contentType: 'application/json; charset=utf-8',
        dataType: 'json',
        success: (data) => {
          const mrcaNodeId = data.mrca.node_id;

          jQuery.ajax({
            type: 'POST',
            url: 'https://api.opentreeoflife.org/v3/tree_of_life/subtree',
            data: JSON.stringify({
              node_id: mrcaNodeId,
              format: 'newick',
              height_limit: 20,
            }),
            contentType: 'application/json; charset=utf-8',
            dataType: 'json',
            success: (data) => {
              this.newick = data.newick;
            },
          })
            .fail(x => console.log("Error accessing Open Tree subtree", x));
        },
      })
        .fail(x => console.log("Error accessing Open Tree MRCA", x));
    },
  }
};
</script>
