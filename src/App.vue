<template>
  <div id="app">
    <TopNavigationBar :version="version" />
    <div id="wrapper">
      <div class="card border-dark">
        <h5 class="card-header border-dark">
          Phyloreferences
        </h5>
        <div class="card-body p-0">
          <PhylorefTable
            :phylorefs="phylorefs"
            :ottInfoBySpecifierLabel="ottInfoBySpecifierLabel"
            :reasoningResults="reasoningResults"
            :nodesByID="nodesByID"
            :unknownOttIdReasons="unknownOttIdReasons"
          />
        </div>
        <div class="card-footer">
          <div class="btn-group" role="group" area-label="Add phyloreferences">
            <button
              class="btn btn-primary"
              href="javascript:;"
              onclick="$('#load-jsonld').trigger('click')"
            >
              Import from ontology in JSON-LD
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
            <button class="btn btn-danger" type="button" @click="phylorefs = []; reasoningResults = {};">
              Clear phylorefs
            </button>
          </div>
          <div class="btn-group ml-2" role="group" area-label="Open Tree Taxonomy tasks">
            <button class="btn btn-primary" type="button" @click="queryOTTIds()">
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
            <div class="form-group row" v-if="unknownOttIds.length > 0">
              <label
                for="newick"
                class="col-md-2 control-label"
              >
                Taxa with Open Tree IDs but not on the synthetic tree
              </label>
              <div class="col-md-10 input-group">
                <template v-for="(ottId, index) of unknownOttIds">
                  <a
                    target="_blank"
                    :key="'unknownOttIds_a_' + ottId"
                    :href="'https://tree.opentreeoflife.org/taxonomy/browse?id=' + ottId.substring(3)"
                  >{{ottId}}</a>
                  <span :key="'unknownOttIds_span_' + ottId" v-if="index+1 < unknownOttIds.length" class="pr-1">,</span>
                </template>
              </div>
            </div>
          </form>
        </div>
        <div class="card-footer">
          <div class="btn-group" role="group" area-label="Look up trees on the Open Tree of Life">
            <button
              class="btn btn-primary"
              href="javascript:;"
              @click="downloadInducedSubtreeFromOToL(ottIdsForAllSpecifiers)"
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
          Phylogeny visualization
        </h5>
        <div class="card-body">
          <Phylotree
            :newick="newick"
            :baseURIForPhylogeny="ONTOLOGY_BASEURI + 'phylogeny'"
          />
        </div>
        <div class="card-footer">
          <div class="btn-group" role="group" area-label="Reason over phylogeny">
            <button
              class="btn btn-primary"
              href="javascript:;"
              @click="reasonOverPhylogeny()"
            >
              Reason over phylogeny <span v-if="reasoningInProgress"><em>(in progress)</em></span>
            </button>

            <button
              class="btn btn-secondary"
              href="javascript:;"
              @click="downloadAsJSONLD()"
            >
              Download as ontology
            </button>
          </div>
        </div>
      </div>

      <!-- Display all the species for a particular clade. -->
      <div
        class="card border-dark mt-2"
      >
        <h5 class="card-header">
          Species in clade
        </h5>
        <div class="card-body">
          <form>
            <div class="form-group row">
              <label
                for="clade-select"
                class="col-md-3 control-label"
              >
                Select a resolved clade from the table above:
              </label>
              <div class="col-md-9 input-group">
                <select id="clade-select">
                  <option @click="selectedPhyloref = undefined">Clear</option>
                  <template v-for="(phyloref, phylorefIndex) of phylorefs">
                    <option @click="selectedPhyloref = phyloref; downloadSpeciesForPhyloref(phyloref)">{{phyloref.label || `Phyloref ${phylorefIndex + 1}`}}<span v-if="!getNodeIdForPhyloref(phyloref)"> (not resolved)</span></option>
                  </template>
                </select>
              </div>
            </div>

            <div class="form-group row" v-if="getNodeIdForPhyloref(selectedPhyloref)" >
              <div class="col-md-3 control-label">
                Resolved to:
              </div>
              <div class="col-md-9 input-group">
                <a target="_blank" :href="'https://tree.opentreeoflife.org/opentree/@' + getNodeIdForPhyloref(selectedPhyloref)">{{getNodeIdForPhyloref(selectedPhyloref)}}</a>
              </div>
            </div>

            <div class="form-group row" v-if="getNodeIdForPhyloref(selectedPhyloref)">
              <div class="col-md-3 control-label">
                Included species:
              </div>
              <div class="col-md-9 input-group">
                <table border="1">
                  <thead>
                    <th>Node ID</th>
                    <th>Name</th>
                    <th>GBIF Species ID</th>
                    <th>GBIF occurrence count</th>
                  </thead>
                  <tbody>
                    <tr v-for="(nodeId, nodeIndex) in selectedPhyloref.species">
                      <td>{{nodeId}}</td>
                      <td>{{speciesByNodeId[nodeId].name}}</td>
                      <td v-if="gbifBySpeciesName && speciesByNodeId[nodeId] && speciesByNodeId[nodeId].name && gbifBySpeciesName[speciesByNodeId[nodeId].name]">
                        <template v-for="speciesId in gbifBySpeciesName[speciesByNodeId[nodeId].name].speciesKey">
                          <a target="_blank" :href="'http://gbif.org/species/' + speciesId">{{speciesId}}</a><br />
                        </template>
                      </td>
                      <td v-if="gbifBySpeciesName && speciesByNodeId[nodeId] && speciesByNodeId[nodeId].name && gbifBySpeciesName[speciesByNodeId[nodeId].name]">{{gbifBySpeciesName[speciesByNodeId[nodeId].name].count}}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </form>
        </div>
        <div class="card-footer" v-if="getNodeIdForPhyloref(selectedPhyloref)">
          <div class="btn-group" role="group" area-label="Query biodiversity databases">
            <button
              class="btn btn-primary"
              href="javascript:;"
              @click="downloadFromGBIF(selectedPhyloref)"
            >
              Query information from GBIF
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- All modals are included here -->
    <AboutOpenTreeResolverModal />
  </div>
</template>

<script>
/*
 * Main application. Provides code for:
 *  - loading phyloreferences from JSON-LD, whether a local file or a URL
 *  - downloading Open Tree Taxonomy (OTT) Ids for each specifier
 *  - downloading the induced subtree for the set of all OTT ids
 */

import { has, isEqual, chunk, uniq, uniqueId, isString, keys } from 'lodash';
import jQuery from 'jquery';
import { PhylogenyWrapper, TaxonomicUnitWrapper } from '@phyloref/phyx';
import Vue from 'vue';
import { signer } from 'x-hub-signature';
import { saveAs } from 'filesaver.js-npm';
import zlib from 'zlib';

// Navigation controls.
import TopNavigationBar from './components/TopNavigationBar.vue';

// Major UI components.
import PhylorefTable from './components/PhylorefTable.vue';
import Phylotree from './components/phylogeny/Phylotree.vue';

// Modal dialogs to be displayed above the UI.
import AboutOpenTreeResolverModal from './components/modals/AboutOpenTreeResolverModal.vue';

export default {
  name: 'App',
  components: {
    TopNavigationBar,
    PhylorefTable,
    AboutOpenTreeResolverModal,
    Phylotree,
  },
  data: function() { return {
    // Open Tree Resolver version
    version: process.env.VUE_APP_VERSION,

    // Currently loaded phyloreferences.
    phylorefs: [],

    // The Newick string for the current phylogeny.
    newick: "()",

    // Dictionary of Open Tree Taxonomy data by scientific name.
    ottInfoByName: {},

    // Dictionary of nodes by their '@id'.
    nodesByID: {},

    // Reasoning results from JPhyloRef.
    reasoningResults: {},

    // Is reasoning currently in progress?
    reasoningInProgress: false,

    // List of unknown OTT Ids, if any.
    unknownOttIds: [],
    unknownOttIdReasons: {},

    // Currently selected phyloref.
    selectedPhyloref: undefined,

    // Contains information on the species inside a node ID.
    // Structure:
    //  speciesByNodeId[nodeId] = [ { "nodeId": "12345", "name": "Homo sapiens", "rank": "species", ... } ]
    speciesByNodeId: {},

    // Contains information on GBIF by species name.
    gbifBySpeciesName: {},

    // URL to Phyx context JSON.
    PHYX_CONTEXT_JSON: "http://www.phyloref.org/phyx.js/context/v0.2.0/phyx.json",

    // URL to be used as the produced ontology's base URI.
    ONTOLOGY_BASEURI: "http://example.org/phyloref_open_tree_resolver#",

    // List of imports in the produced ontology.
    OWL_IMPORTS: [
      'http://raw.githubusercontent.com/phyloref/curation-workflow/develop/ontologies/phyloref_testcase.owl',
      'http://ontology.phyloref.org/2018-12-14/phyloref.owl',
      'http://ontology.phyloref.org/2018-12-14/tcan.owl',
    ],

    // OWL terms we need to refer to.
    CDAO_REPRESENTS_TU: 'obo:CDAO_0000187',
    OWL_RESTRICTION: 'owl:Restriction',
    OWL_ONTOLOGY: 'owl:Ontology',
  }},
  computed: {
    allSpecifiers() {
      // List of all currently loaded specifiers across all phylorefs.
      return this.phylorefs.map(phyloref => this.getSpecifiersForPhyloref(phyloref)).reduce((acc, val) => acc.concat(val), []);
    },
    ottIdsForAllSpecifiers() {
      // The list of all OTT ids across all phylorefs. This assumes that
      // queryOTTIds has already been called!
      const ottIds = this.allSpecifiers.map(specifier => this.getOTTId(specifier))
        .filter(x => x !== undefined && x !== null);
      return ottIds;
    },
    ottInfoBySpecifierLabel() {
      // Convert ottInfoByName into matches by specifier label.
      const ottInfoBySpecifierLabel = {};
      this.allSpecifiers.forEach(specifier => {
        const specifierLabel = new TaxonomicUnitWrapper(specifier).label;
        if(!specifierLabel) return;

        const sciname = this.getScinameForSpecifier(specifier);
        if(!sciname) return;

        const ottId = this.ottInfoByName[sciname];
        if(!ottId) return;

        ottInfoBySpecifierLabel[specifierLabel] = ottId;
      });
      return ottInfoBySpecifierLabel;
    },
    exampleJSONLDURLs() { return [
      // Returns a list of example files to display in the "Examples" menu.
      /*
      {
        url: 'examples/fisher_et_al_2007.jsonld',
        title: 'Fisher et al, 2007',
      },
      {
        url: 'examples/hillis_and_wilcox_2005.jsonld',
        title: 'Hillis and Wilcox, 2005',
      },*/
      {
        url: 'examples/brochu_2003.jsonld',
        title: 'Brochu 2003',
      },
    ]},
  },
  mounted() {
    /**
     * If provided with a special query (#demo), start a "demo" of the
     * functionality of the Open Tree Resolver by loading an example
     * file, looking it up on the Open Tree of Life, and starting reasoning.
     */
    if (window.location.hash == "#demo") {
      this.demo()
    }

  },
  methods: {
    /*
     * Methods for accessing specifiers on Phylorefs
     */

    getSpecifiersForPhyloref(phyloref) {
      // Return a list of all specifiers for a particular phyloreference.
      // Is guaranteed to return a list (even if it's an empty list).
      const specifiers = phyloref.internalSpecifiers || [];
      return specifiers.concat(phyloref.externalSpecifiers || []);
    },

    getScinameForSpecifier(specifier) {
      // Returns the scientific name for a particular specifier.
      // We currently extract this from the specifier label, although once we fix
      // https://github.com/phyloref/phyx.js/issues/7, we should have a better
      // scientific name object to use here.
      const label = new TaxonomicUnitWrapper(specifier).label;
      if(label.startsWith("Specimen")) return undefined;
      const matches = label.match(/^\w+ [a-z-]+/);
      if(matches) return matches[0];
      return undefined;
    },

    getOTTId(specifier) {
      // Returns the OTT taxonomy ID for a particular specifier by scientific name.
      const matches = this.ottInfoByName[this.getScinameForSpecifier(specifier)];
      if(matches && matches.length > 0) {
        return matches[0]['taxon']['ott_id'];
      }
    },

    /*
     * Open Tree synthetic tree methods
     */

    downloadInducedSubtreeFromOToL(ottIds, callback) {
      // Given a set of OTT ids, download the induced subtree from the Open Tree API.

      if(ottIds.length === 0) return;

      // Reset caches.
      Vue.set(this, 'speciesByNodeId', {});
      Vue.set(this, 'gbifBySpeciesName', {});

      // Reset the unknown OTT Ids.
      Vue.set(this, 'unknownOttIds', []);
      Vue.set(this, 'unknownOttIdReasons', {});

      // Query the induced subtree, i.e. a tree showing the relationships between all
      // these OTT ids.
      return jQuery.ajax({
        type: 'POST',
        url: this.$config.OTT_API_INDUCED_SUBTREE,
        data: JSON.stringify({
          ott_ids: ottIds,
        }),
        contentType: 'application/json; charset=utf-8',
        dataType: 'json',
        success: (data) => {
          this.newick = data.newick;
          if (callback) callback(data.newick);
        },
      })
        .fail(x => {
          // If some OTT ids were not found on the synthetic tree, the OTT API
          // will return a list of nodes that could not be matched. We can remove
          // these OTT ids from our list of queries and trying again.
          const regexErrorMessage = /^\[\/v3\/tree_of_life\/induced_subtree\] Error: node_id '\w+' was not found!/;
          if(regexErrorMessage.test(x.responseJSON.message)) {
            const unknownOttIdReasons = x.responseJSON.unknown;
            console.log("The Open Tree synthetic tree does not contain the following nodes: ", unknownOttIdReasons);
            this.unknownOttIdReasons = unknownOttIdReasons;
            this.unknownOttIds = keys(unknownOttIdReasons);

            // Remove the unknown OTT ids from the list of OTT ids to be queried.
            const knownOttIds = ottIds.filter(id => !has(unknownOttIdReasons, "ott" + id));
            console.log("Query has been reduced to the following nodes: ", knownOttIds);

            // Redo query without unknown OTT Ids.
            jQuery.ajax({
              type: 'POST',
              url: this.$config.OTT_API_INDUCED_SUBTREE,
              data: JSON.stringify({
                ott_ids: knownOttIds,
              }),
              contentType: 'application/json; charset=utf-8',
              dataType: 'json',
              success: (data) => {
                this.newick = data.newick;
                if(callback) callback(data.newick);
              },
            }).fail(x => console.log("Error accessing Open Tree induced_subtree", x));
          } else {
            console.log("Error accessing Open Tree induced_subtree", x);
          }
        });
    },

    /*
     * Open Tree Taxonomy methods
     */

    queryOTTIds() {
      // Calculate names from currently loaded specifiers.
      const names = this.allSpecifiers.map(specifier => this.getScinameForSpecifier(specifier));
      return this.queryOTTIdsForNames({names});
    },

    queryOTTIdsForNames(options) {
      // Creates queries to the Open Tree Taxonomy for the provided names.
      // This will return asynchonously; you need to call getOTTId(name)
      // to retrieve the results.
      // Options can be anything from https://github.com/OpenTreeOfLife/germinator/wiki/TNRS-API-v3#match_names, including:
      //  - context_name
      //  - do_approximate_matching

      let setOTTInfoByNames = (results) => {
        // Given a set of matches, fill in the names in this.ottInfoByName.

        results.forEach(info => {
          if(has(info, 'name') && info.name && has(info, 'matches') && info.matches && info.matches.length > 0) {
            const name = info.name.trim();
            Vue.set(this.ottInfoByName, name, info['matches'] || []);
          }
        });
      };

      // Deduplicate names to be queried.
      const names = uniq(options.names)
        .filter(name => name !== undefined && name !== null) // Eliminate any undefineds or nulls.
        .sort();

      // Step 1. Delete existing entries for the provided names.
      setOTTInfoByNames(names.map(name => {
        return {
          name,
          matches: [],
        };
      }));
      // OToL TNRS match_names has a limit of 1,000 names, so we need to chunk
      // our requests to it. Because of that chunking, we will create a single
      // promise that is done when all the individual queries are done.
      return Promise.all(chunk(names, 999).flatMap(chunk => {
        options.names = chunk;
        const data = JSON.stringify(options);
        // Step 2. Spawn queries to OTT asking for the names.
        return jQuery.ajax({
          type: 'POST',
          url: this.$config.OTT_API_TNRS_MATCH_NAMES,
          data,
          contentType: 'application/json; charset=utf-8',
          dataType: 'json',
          success: (data) => {
            setOTTInfoByNames(data.results);
          },
        })
          .fail(x => console.log("Error accessing Open Tree Taxonomy", x));
      }));
    },

    /*
     * Reasoning over phylogenies
     */

    convertTUtoRestriction(tunit) {
      // Return an OWL restriction for a taxonomic unit or specifier.
      // This code is taken from phyx2ontology.js [1], but once it has been moved into
      // phyx.js [2], we can delete it here and call it directly in the library.
      // - [1] https://github.com/phyloref/clade-ontology/blob/02bb88cff1e2cbe28a7214b90b8055a5fc9fd903/phyx2ontology/model2.js#L25-L79
      // - [2] https://github.com/phyloref/phyx.js/issues/4

      return [new TaxonomicUnitWrapper(tunit).asJSONLD];
    },

    getPhylorefsAndPhylogenyAsOntology() {
      // Returns a JSON-LD ontology that can includes the current phylorefs and
      // phylogeny.
      // Note that we only support JSON-LD files as input -- we don't craft
      // clade definitions if they haven't already been created in
      // phyloref.equivalentClass.

      // Add the phyloreferences.
      const phylorefsWithEquivalentClass = this.phylorefs.filter(
        phyloref => has(phyloref, 'equivalentClass')
      );

      phylorefsWithEquivalentClass.forEach(phyloref => {
        // Note that multiple files might have overlapping '@id's.
        // To avoid confusion, we re-@id all the phylorefs.
        phyloref['@id'] = this.ONTOLOGY_BASEURI + 'phyloref_' + uniqueId();

        // Every entity in the JSON-LD needs a '@context', so here is the one for this phyloref.
        if(!has(phyloref, '@context')) {
          phyloref['@context'] = this.PHYX_CONTEXT_JSON;
        }
      });

      // Add the phylogeny.
      const phylogenyNodes = new PhylogenyWrapper({
        newick: this.newick,
      }).getNodesAsJSONLD(this.ONTOLOGY_BASEURI + 'phylogeny');

      // Track nodes by ID so we can look them up by @id later.
      this.nodesByID = {};

      // Modify nodes to support Model 2.0 taxonomic units.
      phylogenyNodes.forEach(nodeAsParam => {
        const node = nodeAsParam;
        // Set a JSON-LD context.
        node['@context'] = this.PHYX_CONTEXT_JSON;

        // Make sure this node has a '@type'.
        if (!has(node, '@type')) node['@type'] = [];
        if (!Array.isArray(node['@type'])) node['@type'] = [node['@type']];
        // We replace "parent" with "obo:CDAO_0000179" so we get has_Parent
        // relationships in our output ontology.
        // To be fixed in https://github.com/phyloref/phyx.js/issues/10
        // if (has(node, 'parent')) node['obo:CDAO_0000179'] = { '@id': node.parent };

        // Does this node have taxonomic units? If so, convert them into class expressions.
        if (has(node, 'representsTaxonomicUnits')) {
          node.representsTaxonomicUnits.forEach((tunit) => {
            this.convertTUtoRestriction(tunit).forEach((restriction) => {
              node['@type'].push({
                '@type': this.OWL_RESTRICTION,
                onProperty: this.CDAO_REPRESENTS_TU,
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
        this.nodesByID[node['@id']] = node;
      });
      // Finally, add a header for this ontology.
      let ontologyHeader = [
        {
          '@context': this.PHYX_CONTEXT_JSON,
          '@id': this.ONTOLOGY_BASEURI,
          '@type': this.OWL_ONTOLOGY,
          'owl:imports': this.OWL_IMPORTS,
        },
      ];

      return JSON.stringify(
        ontologyHeader.concat(phylorefsWithEquivalentClass).concat(phylogenyNodes),
        null,
        4
      );
    },

    downloadAsJSONLD() {
      // Download a copy of the current ontology (to be reasoned over) as JSON-LD.
      const content = [this.getPhylorefsAndPhylogenyAsOntology()];

      // Save to local hard drive.
      const jsonldFile = new File(content, 'download.jsonld', { type: 'application/json;charset=utf-8' });
      saveAs(jsonldFile);
    },

    reasonOverPhylogeny() {
      // Send JSON-LD to server for reasoning. Reasoning results will be stored in
      // this.reasoningResults.

      // Are we already reasoning? If so, ignore.
      if (this.reasoningInProgress) return;
      // Disable "Reason" buttons so they can't be reused.
      this.reasoningInProgress = true;
      this.reasoningResults = {};

      // Make sure that the Reason button is updated before we convert the Phyx
      // file into JSON-LD.
      const outerThis = this;
      Vue.nextTick(function () {
        // Convert phylorefs and phylogeny to JSON-LD.
        const jsonld = outerThis.getPhylorefsAndPhylogenyAsOntology();
        const jsonldGzipped = zlib.gzipSync(jsonld);

        // Prepare request for submission.
        const query = jQuery.param({
          // Convert Gzipped data into a string in Base64.
          jsonldGzipped: Buffer.from(jsonldGzipped).toString('base64')
        }).replace(/%20/g, '+');  // $.post will do this automatically,
                                  // but we need to do this here so our
                                  // signature works.

        // Sign it with an X-Hub-Signature.
        const sign = signer({
            algorithm: 'sha1',
            secret: outerThis.$config.JPHYLOREF_X_HUB_SIGNATURE_SECRET,
        });
        const signature = sign(new Buffer(query));

        console.log('Query: ', query);
        console.log('Signature: ', signature);

        jQuery.post({
          url: outerThis.$config.JPHYLOREF_SUBMISSION_URL,
          data: query,
          headers: {
            'X-Hub-Signature': signature,
          },
        }).done((data) => {
          outerThis.reasoningResults = data.phylorefs;
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
          outerThis.reasoningInProgress = false;
        });
      });
    },

    /*
     * Load phyloreferences from JSON-LD from URLs and files
     */

    loadJSONLDFromURL(url) {
      // Load phylorefs from a JSON-LD file from a given URL.

      return jQuery.getJSON(url)
        .done((data) => {
          this.extractPhylorefsFromJSONLD(data);
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

          this.extractPhylorefsFromJSONLD(jsonld);
        });
        fr.readAsText(file);
      }
    },

    /*
     * Phyloreference management
     */

    extractPhylorefsFromJSONLD(jsonld) {
      // Extract phyloreferences from the provided JSON-LD representation.

      let addPhyloref = (phyloref) => {
        // Add a new phyloref to the list of phylorefs. We use isEqual
        // to prevent adding the same phyloreference more than once, but we will
        // add different phyloreferences with the same '@id'.
        if(this.phylorefs.find(phy => isEqual(phy, phyloref)) !== undefined) return;

        // No previous match? Then add it in!
        this.phylorefs.push(phyloref);
      };

      // JSON-LD files sometimes contain an array of elements. In this case,
      // we should try adding every one.
      if(Array.isArray(jsonld)) {
        jsonld.forEach(element => this.extractPhylorefsFromJSONLD(element));
      }

      // If this was generated by the Authoring Tool, then we can find phyloreferences
      // just by looking for jsonld.phylorefs.
      if(has(jsonld, 'phylorefs') && Array.isArray(jsonld.phylorefs)) {
        jsonld.phylorefs.forEach(phy => addPhyloref(phy));
      }

      // If it was created by phyx2ontology, the phyloreferences can be recognized
      // has having a subClassOf 'phyloref:Phyloreference'. Let's look for that.
      if(has(jsonld, 'subClassOf')) {
        // This entry might have multiple subclasses. If one of them is phyloref:Phyloreference,
        // add it as a phyloreference.
        if(Array.isArray(jsonld.subClassOf) && jsonld.subClassOf.includes('phyloref:Phyloreference'))
          addPhyloref(jsonld);

        // If this entry has a single subclass that is phyloref:Phyloreference,
        // add it as a phyloreference.
        if(jsonld.subClassOf === 'phyloref:Phyloreference')
          addPhyloref(jsonld);
      }
    },

    /* Retrieving lists of species from Open Tree of Life */

    getNodeIdForPhyloref(phyloref) {
      // Return the URL for the Open Tree resolved node for a particular phyloreference.

      if (!phyloref) return undefined;

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
            return matchMRCA[0].toString();
        }
        return match[1].toString();
      }
      return undefined;
    },

    getNodeLabel(node) {
      // Return the label for a particular node.
      const labels = node.labels || [];
      if(labels.length == 0) return undefined;
      return labels[0]; // Ignore other labels.
    },

    downloadSpeciesForPhyloref(phyloref) {
      const ottNodeId = this.getNodeIdForPhyloref(phyloref);
      if (!ottNodeId) return;
      if (has(this.speciesByNodeId, ottNodeId)) return;
      if (has(phyloref, 'species')) return;
      Vue.set(phyloref, 'species', []);

      jQuery.post({
        url: this.$config.OTT_API_SUBTREE,
        contentType: 'application/json; charset=utf-8',
        data: JSON.stringify({
          node_id: ottNodeId,
          format: 'arguson',
          height_limit: -1,
        }),
      }).done((data) => {
        console.log('Data retrieved: ', data);

        const recordTaxa = (node) => {
            if (!node) return;
            if (node.taxon && node.taxon.rank && node.taxon.rank == "species") {
              // Record this species!
              this.speciesByNodeId[node.node_id] = {
                node_id: node.node_id,
                ...node.taxon,
              };
              phyloref.species.push(node.node_id);
              // console.log(`Setting ${node.node_id} to`, node.taxon);
            }
            if (node.children) node.children.forEach(recordTaxa);
        };
        recordTaxa(data.arguson);
        console.log("Found species for phyloref: ", phyloref.species);
      });

      return [];
    },

    /* Code for querying GBIF */
    downloadFromGBIF(phyloref) {
      if (!phyloref.species) return;
      const speciesNames = phyloref.species.map(nodeId => this.speciesByNodeId[nodeId].name);
      speciesNames.forEach(speciesName => {
        console.log("Querying GBIF for species name: ", speciesName);
        jQuery.get({
          url: this.$config.GBIF_API_OCCURRENCE,
          data: {
            scientificName: speciesName,
            rank: 'SPECIES'
          },
        }).done((data) => {
          console.log('Data retrieved: ', data);
          Vue.set(this.gbifBySpeciesName, speciesName, {
            count: data.count,
            speciesKey: Array.from(new Set(data.results.map(result => result.speciesKey))),
          });
        });
      });
    },

    demo() {
      // This demo is designed to demonstrate all the functionality of
      // the Open Tree Resolver.

      // TODO: add UI element to show demo loading processing.
      this.loadJSONLDFromURL(this.exampleJSONLDURLs[0].url).done(() => {
        this.queryOTTIds().then(() => {
          this.downloadInducedSubtreeFromOToL(this.ottIdsForAllSpecifiers, () => {
            this.reasonOverPhylogeny();
          });
        });
      });
    },
  },
};
</script>

<style>
/*
 * Classes for overall design.
 */

#wrapper {
  margin-top: 64px;
  padding: 0.5em 1em;
  transition: all 0.4s ease 0s;
}
</style>
