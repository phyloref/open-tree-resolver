// Include Vue and Vuex to set up them up correctly.
import Vue from 'vue';
import Vuex from 'vuex';

Vue.use(Vuex);

const debug = process.env.NODE_ENV !== 'production';

export default new Vuex.Store({
  state: {},
  modules: {},
  strict: debug,
});
