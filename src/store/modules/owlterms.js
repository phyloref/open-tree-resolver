/*
 * Provides access to terms in the generated JSON-LD file, in particular URIs
 * for the file, phylogenies and phyloreferences.
 */

export default {
  state: {
    phyxBaseURI: '',
  },
  getters: {
    getBaseURIForPhyloref: (state, getters, rootState) => phyloref => `#phyloref${rootState.phyx.currentPhyx.phylorefs.indexOf(phyloref)}`,
  },
};
