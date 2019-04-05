<template>
  <div>
  <div class="card border-dark">
    <h5 class="card-header border-dark">
      Phyloreferences ({{loadedPhylorefs.length}} phylorefs, {{phylorefsWithMoreThanOneSpecifier.length}} phylorefs with more than one specifier, {{phylorefsWithEveryOTTIds.length}} phylorefs with every OTT id, {{allSpecifiers.length}} specifiers, {{ottIdsForAllSpecifiers.length}} specifiers with OTT IDs)
    </h5>
    <div class="card-body p-0">
      <table class="table table-hover table-flush">
        <thead>
          <th>Label</th>
          <th>OToL resolved node</th>
          <th>Specifier</th>
          <th v-if="flagDisplayExpression">Expression</th>
          <th>Scientific name</th>
          <th>OTT Id</th>
        </thead>
        <tbody>
          <tr
            v-if="loadedPhylorefs.length === 0"
            class="bg-white"
          >
            <td colspan="5">
              <center><em>No phyloreferences loaded</em></center>
            </td>
          </tr>
          <template v-for="(phyloref, phylorefIndex) of loadedPhylorefs">
            <tr>
              <td :rowspan="getSpecifiers(phyloref).length + 1">
                {{ phyloref.label || `Phyloref ${phylorefIndex + 1}` }}
              </td>
              <td :rowspan="getSpecifiers(phyloref).length + 1">
                &nbsp;
                <template v-for="(nodeId, nodeIdIndex) of reasoningResults[phyloref['@id']]">
                  <a target="_blank" :href="'https://tree.opentreeoflife.org/opentree/@' + getOTTNodeId(currentNodes[nodeId])[1]">{{getOTTNodeId(currentNodes[nodeId])[1]}}</a><br />
                </template>
              </td>
            </tr>
            <template v-for="specifier of getSpecifiers(phyloref)">
              <tr>
                <td>{{getLabelForSpecifier(specifier)}}</td>
                <td v-if="flagDisplayExpression">{{specifier}}</td>
                <td>{{getScinameForSpecifier(specifier)}}</td>
                <td>
                  <template v-if="getOpenTreeTaxonomyID(specifier)">
                    <a target="_blank" :href="'https://tree.opentreeoflife.org/opentree/@ott' + getOpenTreeTaxonomyID(specifier)">{{getOpenTreeTaxonomyID(specifier)}}</a>

                    <sup><a target="_blank" :href="'https://tree.opentreeoflife.org/taxonomy/browse?id=' + getOpenTreeTaxonomyID(specifier)">ott</a></sup>
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
      <div class="btn-group ml-2" role="group" area-label="Actions on phyloreferences">
        <button class="btn btn-primary" type="button" id="queryOpenTreeTaxonomyIDs" @click="queryOpenTreeTaxonomyIDs()">
          Query Open Tree of Life Taxonomy
        </button>
      </div>
      <div class="btn-group ml-2" role="group" area-label="Actions on phyloreferences">
        <button class="btn btn-danger" type="button" @click="loadedPhylorefs = []; reasoningResults = {}">
          Clear phylorefs
        </button>
      </div>
    </div>
  </div>

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
            class="btn btn-primary"
            href="javascript: void(0)"
            @click="downloadInducedSubtreeFromOpenTreeOfLife(ottIdsForAllSpecifiers)"
          >
            Download induced subtree from the Open Tree of Life
          </button>
          <button
            class="btn btn-secondary"
            href="javascript: void(0)"
            @click="downloadMRCAFromOpenTreeOfLife(ottIdsForAllSpecifiers)"
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
        <!--
        <textarea readonly rows="5" class="form-control" :value="asOntology"></textarea>
        <textarea readonly rows="5" class="form-control" :value="JSON.stringify(reasoningResults, null, 4)"></textarea>
        -->
      </div>
      <div class="card-footer">
        <div class="btn-group" role="group" area-label="Reason over the phylogeny">
          <button
            class="btn btn-primary"
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
        Reasoning results
      </h5>
      <div class="card-body p-0">
        <table id="resolved-nodes-table" class="table table-flush table-striped">
          <tbody>
          <tr><!-- Should really be in thead, but that confuses table2csv -->
            <th>Label</th>
            <th>Phylogeny node</th>
            <th>Node labels</th>
            <th>OToL node</th>
          </tr>
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
              <template v-if="reasoningResults[phyloref['@id']].length == 0">
                <tr>
                  <td>{{ phyloref.label || `Phyloref ${phylorefIndex + 1}` }}</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                </tr>
              </template>
              <template v-for="(nodeId, nodeIdIndex) of reasoningResults[phyloref['@id']]">
                <tr>
                  <td>
                    {{ phyloref.label || `Phyloref ${phylorefIndex + 1}` }}
                  </td>
                  <td>
                    {{ nodeId }}
                  </td>
                  <td>
                    {{ (currentNodes[nodeId].labels || []).join(', ') }}
                  </td>
                  <td>
                    <template v-if="getOTTNodeId(currentNodes[nodeId])">
                      <a target="_blank" :href="'https://tree.opentreeoflife.org/opentree/@' + getOTTNodeId(currentNodes[nodeId])[1]">{{getOTTNodeId(currentNodes[nodeId])[1]}}</a>
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
                  {{ phyloref.label || `Phyloref ${phylorefIndex + 1}` }}
                </td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
              </tr>
            </template>
          </template>
          </tbody>
        </table>
      </div>
      <div class="card-footer">
        <div class="btn-group" role="group" area-label="Export options">
          <button
            class="btn btn-secondary"
            href="javascript: void(0)"
            @click="exportTableAsCSV('#resolved-nodes-table', 'resolved-nodes.csv')"
          >
            Download resolved nodes as CSV
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
</template>

<script>
/*
 * A modal for displaying information about loaded phyloreferences,
 * and the ability to add new phyloreferences.
 */

import { has, isEqual, uniq, chunk, isString } from 'lodash';
import Vue from 'vue';
import { mapState } from 'vuex';
import { PhylogenyWrapper, ScientificNameWrapper, SpecimenWrapper } from '@phyloref/phyx';
import { parse as parseNewick } from 'newick-js';
import jQuery from 'jquery';

import Phylotree from './phylogeny/Phylotree.vue';

export default {
  name: 'PhylorefTable',
  components: {
    Phylotree,
  },
  data: function () {
    return {
      flagDisplayExpression: false,
      loadedPhylorefs: [],
      openTreeTaxonomyInfoByName: {},
      newick: '()',
      PHYX_CONTEXT_JSON: "http://www.phyloref.org/phyx.js/context/v0.1.0/phyx.json",
      ONTOLOGY_BASEURI: "http://example.org/opentreeontology#",
      reasoningInProgress: false,
      reasoningResults: {},
      currentNodes: {}
    };
  },
  computed: {
    phylorefsWithMoreThanOneSpecifier() {
      return this.loadedPhylorefs.filter(phyloref => (this.getSpecifiersForPhyloref(phyloref) || []).length > 1);
    },
    phylorefsWithEveryOTTIds() {
      return this.loadedPhylorefs.filter(phyloref => {
        const specifiers = this.getSpecifiersForPhyloref(phyloref);
        if(specifiers.length > 0 &&
          specifiers.length === specifiers.filter(specifier => this.getOpenTreeTaxonomyID(specifier) !== undefined).length
        ) return true;
      });
    },
    exampleJSONLDURLs() { return [
      // Returns a list of example files to display in the "Examples" menu.
      {
        url: 'examples/brochu_2003.jsonld',
        title: 'Brochu 2003',
      },
    ]},
    allSpecifiers() {
      return this.loadedPhylorefs.map(phyloref => this.getSpecifiers(phyloref)).reduce((acc, val) => acc.concat(val), []);
    },
    ottIdsForAllSpecifiers() {
      // Assumes that queryOpenTreeTaxonomyIDs has already been called!
      const ottIds = this.allSpecifiers.map(specifier => this.getOpenTreeTaxonomyID(specifier))
        .filter(x => x !== undefined && x !== null);

      return ottIds;
    },
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
  },
  methods: {
    getScinameForSpecifier(specifier) {
      const label = this.getLabelForSpecifier(specifier);

      // TODO Fix hack.
      const match = /^(?:includes|excludes) scientific name (\w+) (?:\(originally \w+\)\s+)?([\w\-]+)\b/.exec(label);
      if(match) {
        return `${match[1]} ${match[2]}`
      }

      return undefined;
    },
    getOpenTreeTaxonomyID(specifier) {
      const matches = this.openTreeTaxonomyInfoByName[this.getScinameForSpecifier(specifier)];

      if(matches && matches.length > 0) {
        return matches[0]['taxon']['ott_id'];
      }
    },
    getSpecifiers(phyloref) {
      if(phyloref === undefined) return { internalTUs: [], externalTUs: [], allTUs: [] };

      // Returns a list of TUs for a particular phyloreference.
      return this.getSpecifiersForPhyloref(phyloref);
    },

    loadJSONLDFromURL(url) {
      // Change the current PHYX to that in the provided URL.
      // Will ask the user to confirm before replacing it.

      $.getJSON(url)
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

      const $fileInput = $(fileInputId);
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

    getSpecifiersFromClassExpression(classExpr) {
      let results = [];

      // If classExpr is an array, then process each entry separately.
      if(Array.isArray(classExpr)) {
        return classExpr
          .map(expr => getSpecifiersFromClassExpression(expr))
          .reduce((acc, val) => acc.concat(val), []);
      }

      // If classExpr itself has an equivalentClass, then we should process that instead.
      if(has(classExpr, 'equivalentClass')) {
        results = results.concat(getSpecifiersFromClassExpression(classExpr.equivalentClass));
      }

      // If there are additional classes, then process those too.
      if(has(classExpr, 'hasAdditionalClass')) {
        results = results.concat(getSpecifiersFromClassExpression(classExpr.hasAdditionalClass));
      }

      if(getLabelForSpecifier(classExpr) !== undefined) {
        results.push(classExpr);
      } else {
        if(has(classExpr, 'someValuesFrom')) {
          results = results.concat(getSpecifiersFromClassExpression(classExpr.someValuesFrom));
        }

        if(has(classExpr, 'intersectionOf')) {
          results = results.concat(getSpecifiersFromClassExpression(classExpr.intersectionOf));
        }
      }

      return results;
    },

    getLabelForSpecifier(expr) {
      // Recognize the three standard expression forms.
      // Form 1. obo:CDAO_0000149 some (excludes_TU some ...) and (includes_TU some ...)
      if (
        has(expr, 'onProperty') && expr.onProperty === 'obo:CDAO_0000149' &&
        has(expr, 'someValuesFrom') && has(expr.someValuesFrom, 'intersectionOf')
      ) {
        // There are two possibilities here. We could be looking at the MRCA of two TUs,
        // or we could be looking at the MRCA of one MRCA and one TU. So figure out which
        // it is.
        if(expr.someValuesFrom.intersectionOf.length === 2
          && has(expr.someValuesFrom.intersectionOf[0], 'onProperty') && expr.someValuesFrom.intersectionOf[0].onProperty === 'phyloref:excludes_TU'
          && has(expr.someValuesFrom.intersectionOf[1], 'onProperty') && expr.someValuesFrom.intersectionOf[1].onProperty === 'phyloref:includes_TU'
        ) {
          // Two-TU MRCA!
          const comp1 = this.getLabelForSpecifierExpr(expr.someValuesFrom.intersectionOf[0]);
          const comp2 = this.getLabelForSpecifierExpr(expr.someValuesFrom.intersectionOf[1]);

          return `MRCA(${comp1.substr(25)}, ${comp2.substr(25)})`;
        } else if(
          expr.someValuesFrom.intersectionOf.length === 2
          && has(expr.someValuesFrom.intersectionOf[0], 'onProperty') && expr.someValuesFrom.intersectionOf[0].onProperty === 'phyloref:excludes_lineage_to'
        ) {
          return undefined;
        } else {
          // No idea what this is!
          return undefined;
        }
      }

      // Form 2. includes_TU some (Name and scientificName some X)
      else if (
          (has(expr, 'onProperty') && expr.onProperty === 'phyloref:includes_TU') &&
          (has(expr, 'someValuesFrom') && (
            (has(expr.someValuesFrom, 'onProperty') && expr.someValuesFrom.onProperty === 'http://rs.tdwg.org/ontology/voc/TaxonConcept#hasName') &&
            (has(expr.someValuesFrom, 'someValuesFrom') &&
              (has(expr.someValuesFrom.someValuesFrom, 'intersectionOf')) &&
              (has(expr.someValuesFrom.someValuesFrom.intersectionOf[1], 'onProperty') &&
                expr.someValuesFrom.someValuesFrom.intersectionOf[1].onProperty === 'dwc:scientificName')
            )
          )
        )
      ) {
          return `includes scientific name ${expr.someValuesFrom.someValuesFrom.intersectionOf[1].hasValue}`;
          // return JSON.stringify(expr);
      }
      // Form 3. excludes_TU some (Name and scientificName some X)
      else if (
          (has(expr, 'onProperty') && expr.onProperty === 'phyloref:excludes_TU') &&
          (has(expr, 'someValuesFrom') && (
              (has(expr.someValuesFrom, 'onProperty') && expr.someValuesFrom.onProperty === 'http://rs.tdwg.org/ontology/voc/TaxonConcept#hasName') &&
              (has(expr.someValuesFrom, 'someValuesFrom') &&
                (has(expr.someValuesFrom.someValuesFrom, 'intersectionOf')) &&
                (has(expr.someValuesFrom.someValuesFrom.intersectionOf[1], 'onProperty') &&
                  expr.someValuesFrom.someValuesFrom.intersectionOf[1].onProperty === 'dwc:scientificName')
              )
          ))
      ) {
          return `excludes scientific name ${expr.someValuesFrom.someValuesFrom.intersectionOf[1].hasValue}`;
          // return JSON.stringify(expr);
      } else {
          // Could not match!
          return undefined;
      }
    },

    convertTaxonomicUnitToExpr(type) {
      return (tu) => {
        const property = `phyloref:${type}_TU`;

        if(!has(tu, 'referencesTaxonomicUnits')) return undefined;
        // Only use the first taxonomic unit!
        const tunit = tu.referencesTaxonomicUnits[0];
        // Scientific name?
        if (has(tunit, 'scientificNames')) {
          return {
            onProperty: property,
            someValuesFrom: {
              onProperty: 'http://rs.tdwg.org/ontology/voc/TaxonConcept#hasName',
              someValuesFrom: {
                intersectionOf: [
                  {
                    "@id": "obo:NOMEN_0000107"
                  },
                  {
                    onProperty: 'dwc:scientificName',
                    hasValue: tunit.scientificNames[0].scientificName
                  }
                ]
              }
            }
          };
        } else {
          // We don't support anything else!
          return undefined;
        }
      }
    },

    getSpecifiersForPhyloref(phyloref) {
      // phyloref: Phyloreference to retrieve specifiers from.
      //
      // All phyloref objects should have internal and external specifier
      // information. But first, let's see if we can extract it directly from
      // the equivalentClass statement.

      if(has(phyloref, 'internalSpecifiers')) {
        // Old form! Let's just extract the taxonomic units and go with that.
        const internals = (phyloref['internalSpecifiers'] || [])
          .map(this.convertTaxonomicUnitToExpr('includes'))
          .filter(tu => tu !== undefined);
        const externals = (phyloref['externalSpecifiers'] || [])
          .map(this.convertTaxonomicUnitToExpr('excludes'))
          .filter(tu => tu !== undefined);

        if(internals.length === 0) return [];
        if(externals.length === 0) {
          return internals;
        }
        return internals.concat(externals);
      }

      return uniqWith(
        this.getSpecifiersFromClassExpression(phyloref || []),
        isEqual
      );
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
    reasonOverPhylogeny() {
      // Send JSON-LD to server for reasoning.
      // Reason over all the phyloreferences and store the results on
      // the Vue model at vm.reasoningResults so we can access them.

      // Are we already reasoning? If so, ignore.
      if (this.reasoningInProgress) return;

      // Disable "Reason" buttons so they can't be reused.
      this.reasoningInProgress = true;
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
        url: 'https://ot39.opentreeoflife.org/v3/tree_of_life/induced_subtree',
        data: JSON.stringify({
          ott_ids: ottIds,
        }),
        contentType: 'application/json; charset=utf-8',
        dataType: 'json',
        success: (data) => {
          this.newick = data.newick;
        },
      })
        .fail(x => {
          if(x.responseJSON.message === "[/v3/tree_of_life/induced_subtree] Error: Nodes not found!") {
            const unknownOttIds = x.responseJSON.unknown;
            console.log("The Open Tree synthetic tree does not contain the following nodes: ", unknownOttIds);

            const knownOttIds = ottIds.filter(id => !has(unknownOttIds, "ott" + id));
            console.log("Query has been reduced to the following nodes: ", knownOttIds);

            // Redo query without unknown OTT Ids.
            jQuery.ajax({
              type: 'POST',
              url: 'https://ot39.opentreeoflife.org/v3/tree_of_life/induced_subtree',
              data: JSON.stringify({
                ott_ids: knownOttIds,
              }),
              contentType: 'application/json; charset=utf-8',
              dataType: 'json',
              success: (data) => {
                this.newick = data.newick;
              },
            }).fail(x => console.log("Error accessing Open Tree induced_subtree", x));
          } else {
            console.log("Error accessing Open Tree induced_subtree", x);
          }
        });
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
    exportTableAsCSV(tableId, filename) {
      jQuery(tableId).first().table2csv('download', { filename });
    },
  }
};
</script>
