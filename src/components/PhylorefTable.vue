<template>
  <div class="card border-dark">
    <h5 class="card-header border-dark">
      Phyloreferences
    </h5>
    <div class="card-body p-0">
      <table class="table table-hover table-flush">
        <thead>
          <th>Label</th>
          <th>Specifier</th>
          <th>Expression</th>
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
            <tr>
              <td :rowspan="getSpecifiers(phyloref).length + 1">
                <a
                  href="javascript: void(0)"
                >
                  {{ phyloref.label || `Phyloref ${phylorefIndex + 1}` }}
                </a>
              </td>
            </tr>
            <template v-for="specifier of getSpecifiers(phyloref)">
              <tr>
                <td>{{getLabelForSpecifier(specifier)}}</td>
                <td>{{specifier}}</td>
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
    </div>
  </div>
</template>

<script>
/*
 * A modal for displaying information about loaded phyloreferences,
 * and the ability to add new phyloreferences.
 */

import { mapState } from 'vuex';

export default {
  name: 'PhylorefTable',
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
    ...mapState({
      loadedPhylorefs: state => state.phylorefs.loaded
    })
  },
  methods: {
    getLabelForSpecifier(specifier) {
      return this.$store.getters.getLabelForSpecifier(specifier);
    },
    getSpecifiers(phyloref) {
      if(phyloref === undefined) return { internalTUs: [], externalTUs: [], allTUs: [] };

      // Returns a list of TUs for a particular phyloreference.
      return this.$store.getters.getSpecifiersForPhyloref(phyloref);
    },
    loadJSONLDFromURL(url) {
      // Change the current PHYX to that in the provided URL.
      // Will ask the user to confirm before replacing it.

      $.getJSON(url)
        .done((data) => {
          this.$store.commit('extractPhyloreferencesFromJSONLD', data);
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

          this.$store.commit('extractPhyloreferencesFromJSONLD', jsonld);
        });
        fr.readAsText(file);
      }
    },
  }
};
</script>
