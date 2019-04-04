// Include Vue and Vuex to set up them up correctly.
import Vue from 'vue';
import Vuex from 'vuex';

// TODO The following need reorganizing.
import owlterms from './modules/owlterms';
import phyloref from './modules/phyloref';
import phyx from './modules/phyx';
import phylogeny from './modules/phylogeny';

Vue.use(Vuex);

const debug = process.env.NODE_ENV !== 'production';

export default new Vuex.Store({
  state: {},
  modules: {
    owlterms,
    phyloref,
    phyx,
    phylogeny,
  },
  strict: debug,
});
