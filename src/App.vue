<template>
  <div id="app">
    <TopNavigationBar :version="OPEN_TREE_RESOLVER_VERSION" />
    <div id="wrapper">
      <div class="card border-dark">
        <h5 class="card-header border-dark">
          Phyloreferences
        </h5>
        <div class="card-body p-0">
          <PhylorefTable
            :phylorefs="phylorefs"
            :openTreeTaxonomyInfoBySpecifierLabel="openTreeTaxonomyInfoBySpecifierLabel"
            :reasoningResults="reasoningResults"
          />
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
            <button class="btn btn-danger" type="button" @click="phylorefs = []">
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
              @click="downloadInducedSubtreeFromOpenTreeOfLife(ottIdsForAllSpecifiers)"
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
              Reason over phylogeny
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
 *  - downloading Open Tree Taxonomy (OTT) IDs for each specifier
 *  - downloading the induced subtree for the set of all OTT ids
 */

import { has, isEqual, chunk, uniq, uniqueId, isString } from 'lodash';
import jQuery from 'jquery';
import { PhylorefWrapper, SpecimenWrapper, ScientificNameWrapper, PhylogenyWrapper } from '@phyloref/phyx';
import Vue from 'vue';

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
    OPEN_TREE_RESOLVER_VERSION: "0.1.0",

    // Currently loaded phyloreferences
    phylorefs: [],
    newick: "()",
    openTreeTaxonomyInfoByName: {},
    reasoningResults: {},
    reasoningInProgress: false,
    PHYX_CONTEXT_JSON: "http://www.phyloref.org/phyx.js/context/v0.1.0/phyx.json",
    ONTOLOGY_BASEURI: "http://example.org/phyloref_open_tree_resolver#",
  }},
  computed: {
    allSpecifiers() {
      // List of all currently loaded specifiers across all phylorefs.
      return this.phylorefs.map(phyloref => this.getSpecifiersForPhyloref(phyloref)).reduce((acc, val) => acc.concat(val), []);
    },
    ottIdsForAllSpecifiers() {
      // The list of all OTT ids across all phylorefs. This assumes that
      // queryOpenTreeTaxonomyIDs has already been called!
      const ottIds = this.allSpecifiers.map(specifier => this.getOpenTreeTaxonomyID(specifier))
        .filter(x => x !== undefined && x !== null);
      return ottIds;
    },
    openTreeTaxonomyInfoBySpecifierLabel() {
      // Convert openTreeTaxonomyInfoByName into matches by specifier label.
      const openTreeTaxonomyInfoBySpecifierLabel = {};
      this.allSpecifiers.forEach(specifier => {
        const specifierLabel = PhylorefWrapper.getSpecifierLabel(specifier);
        if(!specifierLabel) return;

        const sciname = this.getScinameForSpecifier(specifier);
        if(!sciname) return;

        const ottId = this.openTreeTaxonomyInfoByName[sciname];
        if(!ottId) return;

        openTreeTaxonomyInfoBySpecifierLabel[specifierLabel] = ottId;
      });
      return openTreeTaxonomyInfoBySpecifierLabel;
    },
    asOntology() {
      const phylorefsWithEquivalentClass = this.phylorefs.filter(
        phyloref => has(phyloref, 'equivalentClass')
      );
      // Add the phylogeny.
      const phylogenyNodes = new PhylogenyWrapper({
        newick: this.newick,
      }).getNodesAsJSONLD(this.ONTOLOGY_BASEURI + 'phylogeny');

      phylorefsWithEquivalentClass.forEach(phyloref => {
        if(has(phyloref, 'label')) {
          if(!has(phyloref, '@id')) {
            phyloref['@id'] = this.ONTOLOGY_BASEURI + 'phyloref_' + uniqueId();
          }
        }
      });

      // Modify nodes to support Model 2.0 taxonomic units.
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
    ]},
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
      const label = PhylorefWrapper.getSpecifierLabel(specifier);
      if(label.startsWith("Specimen")) return undefined;
      const matches = label.match(/^\w+ [a-z-]+/);
      if(matches) return matches[0];
      return undefined;
    },

    getOpenTreeTaxonomyID(specifier) {
      // Returns the OTT taxonomy ID for a particular specifier by scientific name.
      const matches = this.openTreeTaxonomyInfoByName[this.getScinameForSpecifier(specifier)];
      if(matches && matches.length > 0) {
        return matches[0]['taxon']['ott_id'];
      }
    },

    /*
     * Open Tree synthetic tree methods
     */

    downloadInducedSubtreeFromOpenTreeOfLife(ottIds) {
      // Given a set of OTT ids, download the induced subtree from the Open Tree API.

      if(ottIds.length === 0) return;

      // Query the induced subtree, i.e. a tree showing the relationships between all
      // these OTT ids.
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
          // If some OTT ids were not found on the synthetic tree, the OTT API
          // will return a list of nodes that could not be matched. We can remove
          // these OTT ids from our list of queries and trying again.
          if(x.responseJSON.message === "[/v3/tree_of_life/induced_subtree] Error: Nodes not found!") {
            const unknownOttIds = x.responseJSON.unknown;
            console.log("The Open Tree synthetic tree does not contain the following nodes: ", unknownOttIds);

            // Remove the unknown OTT ids from the list of OTT ids to be queried.
            const knownOttIds = ottIds.filter(id => !has(unknownOttIds, "ott" + id));
            console.log("Query has been reduced to the following nodes: ", knownOttIds);

            // Redo query without unknown OTT Ids.
            jQuery.ajax({
              type: 'POST',
              url: 'https://api.opentreeoflife.org/v3/tree_of_life/induced_subtree',
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

    /*
     * Open Tree Taxonomy methods
     */

    queryOpenTreeTaxonomyIDs() {
      // Calculate names from currently loaded specifiers.
      const names = this.allSpecifiers.map(specifier => this.getScinameForSpecifier(specifier));
      this.queryOpenTreeTaxonomyIDsForNames({names});
    },

    queryOpenTreeTaxonomyIDsForNames(options) {
      // Creates queries to the Open Tree Taxonomy for the provided names.
      // This will return asynchonously; you need to call getOpenTreeTaxonomyID(name)
      // to retrieve the results.
      // Options can be anything from https://github.com/OpenTreeOfLife/germinator/wiki/TNRS-API-v3#match_names, including:
      //  - context_name:
      //  - do_approximate_matching

      let setOpenTreeTaxonomyInfoByNames = (results) => {
        // Given a set of matches, fill in the names in this.openTreeTaxonomyInfoByName.

        results.forEach(info => {
          if(has(info, 'name') && info.name && has(info, 'matches') && info.matches && info.matches.length > 0) {
            const name = info.name.trim();
            Vue.set(this.openTreeTaxonomyInfoByName, name, info['matches'] || []);
          }
        });
      };

      // Deduplicate names to be queried.
      const names = uniq(options.names)
        .filter(name => name !== undefined && name !== null) // Eliminate any undefineds or nulls.
        .sort();

      // Step 1. Delete existing entries for the provided names.
      setOpenTreeTaxonomyInfoByNames(names.map(name => {
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
            setOpenTreeTaxonomyInfoByNames(data.results);
          },
        })
          .fail(x => console.log("Error accessing Open Tree Taxonomy", x));
      });
    },

    /* Reasoning over phylogenies. */

    convertTUtoRestriction(tunit) {
      // Return an OWL restriction for a taxonomic unit or specifier.
      // This code is taken from phyx2ontology.js [1], but once it has been moved into
      // phyx.js [2], we can delete it here and call it directly in the library.
      // - [1] https://github.com/phyloref/clade-ontology/blob/02bb88cff1e2cbe28a7214b90b8055a5fc9fd903/phyx2ontology/model2.js#L25-L79
      // - [2] https://github.com/phyloref/phyx.js/issues/4

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
      // Send JSON-LD to server for reasoning. Reasoning results will be stored in
      // this.reasoningResults.

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

    /*
     * Load phyloreferences from JSON-LD from URLs and files
     */

    loadJSONLDFromURL(url) {
      // Load phylorefs from a JSON-LD file from a given URL.

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

    /*
     * Phyloreference management
     */

    extractPhyloreferencesFromJSONLD(jsonld) {
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
        jsonld.forEach(element => this.extractPhyloreferencesFromJSONLD(element));
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
