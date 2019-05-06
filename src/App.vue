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

import { has, isEqual } from 'lodash';
import jQuery from 'jquery';

// Navigation controls.
import TopNavigationBar from './components/TopNavigationBar.vue';

// Major UI components.
import PhylorefTable from './components/PhylorefTable.vue';

// Modal dialogs to be displayed above the UI.
import AboutOpenTreeResolverModal from './components/modals/AboutOpenTreeResolverModal.vue';

export default {
  name: 'App',
  components: {
    TopNavigationBar,
    PhylorefTable,
    AboutOpenTreeResolverModal,
  },
  data: function() { return {
    // Open Tree Resolver version
    OPEN_TREE_RESOLVER_VERSION: "0.1.0",

    // Currently loaded phyloreferences
    phylorefs: [],
  }},
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
    ]},
  },
  methods: {

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
