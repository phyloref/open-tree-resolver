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
            :openTreeTaxonomyInfoByName="openTreeTaxonomyInfoByName"
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
          Phylogeny
        </h5>
        <div class="card-body">
          <Phylotree
            :newick="newick"
          />
        </div>
      </div>
    </div>

    <!-- All modals are included here -->
    <AboutOpenTreeResolverModal />
  </div>
</template>

<script>
/*
 * Main application. Provides code for loading phyloreferences from JSON-LD,
 * whether a local file or a URL.
 */

import { has, isEqual, chunk, uniq } from 'lodash';
import jQuery from 'jquery';
import { PhylorefWrapper } from '@phyloref/phyx';
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
    PHYX_CONTEXT_JSON: "http://www.phyloref.org/phyx.js/context/v0.1.0/phyx.json",
    ONTOLOGY_BASEURI: "http://example.org/#",
    reasoningInProgress: false,
    reasoningResults: {},
    currentNodes: {},
  }},
  computed: {
    allSpecifiers() {
      return this.phylorefs.map(phyloref => this.getSpecifiersForPhyloref(phyloref)).reduce((acc, val) => acc.concat(val), []);
    },
    phylorefsWithMoreThanOneSpecifier() {
      return this.phylorefs.filter(phyloref => (this.getSpecifiersForPhyloref(phyloref) || []).length > 1);
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
    ]},
  },
  methods: {
    /* Methods for accessing specifiers on Phylorefs */

    getSpecifiersForPhyloref(phyloref) {
      // Return a list of all specifiers for a particular phyloreference.
      // Is guaranteed to return a list (even if it's an empty list).
      const specifiers = phyloref.internalSpecifiers || [];
      return specifiers.concat(phyloref.externalSpecifiers || []);
    },

    getScinameForSpecifier(specifier) {
      const label = PhylorefWrapper.getSpecifierLabel(specifier);
      if(label.startsWith("Specimen")) return undefined;
      const matches = label.match(/^\w+ [a-z-]+/);
      if(matches) return matches[0];
      return undefined;
    },

    getOpenTreeTaxonomyID(specifier) {
      const matches = this.openTreeTaxonomyInfoByName[this.getScinameForSpecifier(specifier)];
      if(matches && matches.length > 0) {
        return matches[0]['taxon']['ott_id'];
      }
    },

    /* Open Tree synthetic tree methods */

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

    /* Open Tree Taxonomy methods */

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
