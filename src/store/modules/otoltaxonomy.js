/*
 * Store module for looking up information from the Open Tree of Life Taxonomy.
 */

import Vue from 'vue';
import jQuery from 'jquery';
import { has, chunk, uniq } from 'lodash';

export default {
  state: {
    openTreeTaxonomyInfoByName: {}
  },
  getters: {
  },
  mutations: {
    setOpenTreeTaxonomyInfoByNames: (state, results) => {
      results.forEach(info => {
          if(has(info, 'name') && info.name && has(info, 'matches') && info.matches && info.matches.length > 0) {
            const name = info.name.trim();

            // console.log("Setting", name, "to", info['matches']);

            // Do we have any flags? If so, ignore this.
            if((info.matches[0].taxon.flags || []).length > 0) {
              console.log("Ignoring", name, "because of flags:", info.matches[0].taxon.flags);
              return;
            }

            // TODO do something cleverer when choosing between multiple matches
            Vue.set(state.openTreeTaxonomyInfoByName, name, info['matches'] || []);
          }
      });
    },
  },
  actions: {
    queryOpenTreeTaxonomyIDs: (context, options) => {
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
      context.commit('setOpenTreeTaxonomyInfoByNames', names.map(name => {
        return {
          name,
          matches: [],
        };
      }));

      // OToL TNRS match_names has a limit of 1,000 names.
      chunk(names, 999).forEach(chunk => {
        options.names = chunk;
        const data = JSON.stringify(options);
        // console.log("Sent query", data);

        // Step 2. Spawn queries to OTT asking for the names.
        jQuery.ajax({
          type: 'POST',
          url: 'https://api.opentreeoflife.org/v3/tnrs/match_names',
          data,
          contentType: 'application/json; charset=utf-8',
          dataType: 'json',
          success: (data) => {
            context.commit('setOpenTreeTaxonomyInfoByNames', data.results);
          },
        })
          .fail(x => console.log("Error accessing Open Tree Taxonomy", x));
      });
    }
  }
};
