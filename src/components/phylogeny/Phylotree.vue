<template>
  <div>
    <template v-if="newickErrors.length > 0">
      <template v-for="(error, errorIndex) of newickErrors">
        <p :key="errorIndex"><strong>{{ error.title }}.</strong> {{ error.message }}</p>
      </template>
    </template>
    <template
      v-else
      class="phylotreeContainer"
    >
      <svg
        class="col-md-12 phylogeny"
        :id="'phylogeny_' + phylogenyIndex"
      />
      <ResizeObserver @notify="redrawTree()" />
    </template>
  </div>
</template>

<script>
/*
 * This component uses Phylotree.js to display a phylogeny, including internal
 * nodes. It does not support highlighting resolved clades.
 *
 * Note that this requires the Phylotree Javascript to be loaded in the HTML header:
 * I haven't figured out how to include phylotree.js from within Vue CLI yet.
 */

import { uniqueId, has } from 'lodash';
import { PhylogenyWrapper, TaxonomicUnitWrapper } from '@phyloref/phyx';
import Vue from 'vue';
import jQuery from 'jquery';
import { ResizeObserver } from 'vue-resize';

// Set up ResizeObserver so we can redraw the tree if the window is resized.
Vue.component('ResizeObserver', ResizeObserver);

export default {
  name: 'Phylotree',
  props: {
    /* Inputs */
    newick: { // The Newick string of the phylogeny to display.
      type: String,
      default: '()',
    },
    spacingX: { // Spacing in the X axis in pixels.
      type: Number,
      default: 20,
    },
    phylogenyIndex: { // An index number of the phylogeny. Will be used to set up HTML DOM IDs.
      type: String,
      default: uniqueId(),
    },
    baseURIForPhylogeny: {
      type: String,
    },

    /* Configuration options */
    displayInternalNodes: { // Flag for whether to display internal node labels
      type: Boolean,
      default: false,
    },
  },
  computed: {
    baseURIForPhylogenyComputed() {
      return this.baseURIForPhylogeny || `http://example.org/#phylogeny${this.phylogenyIndex}`;
    },
    parsedNewick() {
      // Return a tree-like structure that represents a Newick string. Phylotree.js
      // is loaded,we use d3.layout.newick_parser; otherwise, we use the default
      // parser used by PhylogenyWrapper.
      if (has(window, 'd3') && has(window.d3, 'layout') && has(window.d3.layout, 'newick_parser')) {
        return new PhylogenyWrapper({ newick: this.newick }).getParsedNewickWithIRIs(
          this.baseURIForPhylogenyComputed,
          window.d3.layout.newick_parser,
        );
      }

      return new PhylogenyWrapper({ newick: this.newick }).getParsedNewickWithIRIs(
        this.baseURIForPhylogenyComputed
      );
    },
    newickErrors() {
      // Return a list of errors found in this Newick string.
      const errors = PhylogenyWrapper.getErrorsInNewickString(this.newick);

      // For historical reason, we consider an empty Newick string as an error.
      // Will be fixed in https://github.com/phyloref/phyx.js/issues/13
      return errors.filter(error => error.title !== 'No phylogeny entered');
    },
    tree() {
      // Set up Phylotree.js.

      // Is Phylotree actually loaded? If not, bail out.
      if (!has(window, 'd3') || !has(window.d3, 'layout') || !has(window.d3.layout, 'phylotree')) return;

      // Set up Phylotree.
      const tree = window.d3.layout.phylotree()
        .svg(window.d3.select(`#phylogeny_${this.phylogenyIndex}`))
        .options({
          'internal-names': true,
          transitions: false,
          'left-right-spacing': 'fit-to-size',
          'top-bottom-spacing': 'fixed-step',
        })
        .style_nodes((element, data) => {
          // Instructions used to style nodes in Phylotree
          // - element: The D3 element of the node being styled
          // - data: The data associated with the node being styled

          // Make sure we don't already have an internal label node on this SVG node!
          let textLabel = element.selectAll('text');

          if (has(data, 'name') && data.name !== '' && data.children) {
            // If the node has a label and has children (i.e. is an internal node),
            // we display it next to the node by creating a new 'text' element.
            if (this.displayInternalNodes && textLabel.empty()) {
              textLabel = element.append('text');

              // Place internal label to the left of the root node.
              textLabel.classed('internal-label', true)
                .text(data.name)
                .attr('dx', '.3em')
                .attr('dy', '.3em');
            }
          }

          if (data.name !== undefined && data.children === undefined) {
            // Labeled leaf node! Look for taxonomic units.
            const tunits = TaxonomicUnitWrapper.getTaxonomicUnitsFromNodeLabel(data.name);

            if (tunits.length === 0) {
              element.classed('terminal-node-without-tunits', true);
            }
          }
        });
      tree(this.parsedNewick);
      return tree;
    },
  },
  methods: {
    redrawTree() {
      // Redraw the tree set up earlier.
      const tree = this.tree;

      if (tree) {
        // Draw the tree.
        this.tree
          .size([
            // height
            0,
            // width
            jQuery(`#phylogeny_${this.phylogenyIndex}`).width(),
            // We need more space because our fonts are bigger than the default.
          ])
          .spacing_x(this.spacingX)
          .update();
      }
    },
  },
  mounted() {
    // Redraw the tree when this component is loaded for the first time.
    this.redrawTree();
  },
  watch: {
    newick() {
      // If the Newick changes, redraw the tree.
      this.redrawTree();
    },
  },
};
</script>

<style>
.phylogeny {
  width: 100%;
}
.phylotreeContainer {
  /* Required for Vue-Resize to track its size */
  position: relative;
}

/*
 * Classes for phylogeny SVG elements
 */

/*
 * Phylotree .node refers to the SVG groups that contain both the
 * node itself as well as the text label next to it. This is confusing,
 * but we will try to use that consistently below: *-node refers to the group
 * that includes both the node as well as the label with it, while *-label
 * refers only to the labels next to the nodes.
 */
.node {
  font-size: 11pt;
}

/* Labels for internal nodes, whether phylorefs or not */
.internal-label {
  font-family: serif;
  font-size: 16pt;
  font-style: italic;

  text-anchor: start; /* Align text so it starts at the coordinates provided */
}

/* Node label for an internal specifier */
.internal-specifier-node text {
    font-weight: bolder;
    fill: rgb(0, 24, 168) !important;
}

/* Node label for an external specifier */
.external-specifier-node text {
    font-weight: bolder;
    fill: rgb(0, 24, 168) !important;
}

/* Node label for a terminal node without taxonomic units */
.terminal-node-without-tunits {
}

/*
 * Create a table class for a fixed size body.
 * Based on https://stackoverflow.com/a/23518856/27310
 */
.table-fixed-height {
}

.table-fixed-height thead {
    display: block;
    width: 100%;
}

.table-fixed-height tbody {
    display: block;
    width: 100%;
    height: 15em;
    overflow-y: scroll;
    z-index: -1;
}

.table-fixed-height tr {
    width: 100%;
    display: inline-table;
    table-layout: fixed;
}

/*
 * The following code is stolen from Bootstrap 3.3, which is a Phylotree.js
 * dependency. Since we otherwise use Bootstrap 4+, we need to override this
 * here so the menu works.
 *
 * We apply it only to subclasses of #d3_layout_phylotree_context_menu to limit
 * their fallout on other elements.
 */
#d3_layout_phylotree_context_menu.dropdown-menu {
 position: absolute;
 top: 100%;
 left: 0;
 z-index: 1000;
 display: none;
 float: left;
 min-width: 160px;
 padding: 5px 0;
 margin: 2px 0 0;
 font-size: 14px;
 text-align: left;
 list-style: none;
 background-color: #fff;
 -webkit-background-clip: padding-box;
         background-clip: padding-box;
 border: 1px solid #ccc;
 border: 1px solid rgba(0, 0, 0, .15);
 border-radius: 4px;
 -webkit-box-shadow: 0 6px 12px rgba(0, 0, 0, .175);
         box-shadow: 0 6px 12px rgba(0, 0, 0, .175);
}
#d3_layout_phylotree_context_menu.dropdown-menu.pull-right {
 right: 0;
 left: auto;
}
#d3_layout_phylotree_context_menu.dropdown-menu .divider {
 height: 1px;
 margin: 9px 0;
 overflow: hidden;
 background-color: #e5e5e5;
}
#d3_layout_phylotree_context_menu.dropdown-menu > li > a {
 display: block;
 padding: 3px 20px;
 clear: both;
 font-weight: normal;
 line-height: 1.42857143;
 color: #333;
 white-space: nowrap;
}
#d3_layout_phylotree_context_menu.dropdown-menu > li > a:hover,
#d3_layout_phylotree_context_menu.dropdown-menu > li > a:focus {
 color: #262626;
 text-decoration: none;
 background-color: #f5f5f5;
}
#d3_layout_phylotree_context_menu.dropdown-menu > .active > a,
#d3_layout_phylotree_context_menu.dropdown-menu > .active > a:hover,
#d3_layout_phylotree_context_menu.dropdown-menu > .active > a:focus {
 color: #fff;
 text-decoration: none;
 background-color: #337ab7;
 outline: 0;
}
#d3_layout_phylotree_context_menu.dropdown-menu > .disabled > a,
#d3_layout_phylotree_context_menu.dropdown-menu > .disabled > a:hover,
#d3_layout_phylotree_context_menu.dropdown-menu > .disabled > a:focus {
 color: #777;
}
#d3_layout_phylotree_context_menu.dropdown-menu > .disabled > a:hover,
#d3_layout_phylotree_context_menu.dropdown-menu > .disabled > a:focus {
 text-decoration: none;
 cursor: not-allowed;
 background-color: transparent;
 background-image: none;
 filter: progid:DXImageTransform.Microsoft.gradient(enabled = false);
}
.open > #d3_layout_phylotree_context_menu.dropdown-menu {
 display: block;
}
#d3_layout_phylotree_context_menu.dropdown-menu-right {
 right: 0;
 left: auto;
}
#d3_layout_phylotree_context_menu.dropdown-menu-left {
 right: auto;
 left: 0;
}
#d3_layout_phylotree_context_menu.dropdown-header {
 display: block;
 padding: 3px 20px;
 font-size: 12px;
 line-height: 1.42857143;
 color: #777;
 white-space: nowrap;
}
#d3_layout_phylotree_context_menu.dropdown-backdrop {
 position: fixed;
 top: 0;
 right: 0;
 bottom: 0;
 left: 0;
 z-index: 990;
}

</style>
