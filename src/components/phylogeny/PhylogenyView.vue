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
  </div>
</template>

<script>
/*
 * This view displays a phylogeny and changes its title or Newick string.
 */

import { has } from 'lodash';
import { mapState } from 'vuex';
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
  }},
  computed: {
    /*
     * The following properties allow you to get or set the phylogeny label,
     * description or newick string.
     */
    phylogenyNewickErrors() {
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
    }),
  },
  methods: {
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
