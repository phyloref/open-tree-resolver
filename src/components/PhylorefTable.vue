<template>
  <div>
  <div class="card border-dark">
    <h5 class="card-header border-dark">
      Phyloreferences ({{loadedPhylorefs.length}} phylorefs, {{phylorefsWithMoreThanOneSpecifier.length}} phylorefs with more than one specifier, {{phylorefsWithEveryOTTIds.length}} phylorefs with every OTT id, {{allSpecifiers.length}} specifiers, {{ottIdsForAllSpecifiers.length}} specifiers with OTT IDs)
    </h5>
    <div class="card-body p-0">
      <table class="table table-hover table-flush">
        <thead>
          <th>Label</th>
          <th>Specifier</th>
          <th v-if="flagDisplayExpression">Expression</th>
          <th>Scientific name</th>
          <th>OTT Id</th>
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
                {{ phyloref.label || `Phyloref ${phylorefIndex + 1}` }}
              </td>
            </tr>
            <template v-for="specifier of getSpecifiers(phyloref)">
              <tr>
                <td>{{getLabelForSpecifier(specifier)}}</td>
                <td v-if="flagDisplayExpression">{{specifier}}</td>
                <td>{{getScinameForSpecifier(specifier)}}</td>
                <td>
                  <template v-if="getOpenTreeTaxonomyID(specifier)">
                    <a target="_blank" :href="'https://tree.opentreeoflife.org/opentree/@ott' + getOpenTreeTaxonomyID(specifier)">{{getOpenTreeTaxonomyID(specifier)}}</a>

                    <sup><a target="_blank" :href="'https://tree.opentreeoflife.org/taxonomy/browse?id=' + getOpenTreeTaxonomyID(specifier)">ott</a></sup>
                  </template>
                </td>
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
      <div class="btn-group ml-2" role="group" area-label="Actions on phyloreferences">
        <button class="btn btn-primary" type="button" id="queryOpenTreeTaxonomyIDs" @click="queryOpenTreeTaxonomyIDs()">
          Query Open Tree of Life Taxonomy
        </button>
      </div>
      <div class="btn-group ml-2" role="group" area-label="Actions on phyloreferences">
        <button class="btn btn-danger" type="button" @click="loadedPhylorefs = []">
          Clear phylorefs
        </button>
      </div>
    </div>
  </div>

  <PhylogenyView :phylorefs='loadedPhylorefs' :ottIds='ottIdsForAllSpecifiers' />
</div>
</template>

<script>
/*
 * A modal for displaying information about loaded phyloreferences,
 * and the ability to add new phyloreferences.
 */

import { has, isEqual, uniq, chunk } from 'lodash';
import Vue from 'vue';
import { mapState } from 'vuex';
import PhylogenyView from './phylogeny/PhylogenyView';

export default {
  name: 'PhylorefTable',
  components: {
    PhylogenyView,
  },
  data: function () {
    return {
      flagDisplayExpression: false,
      loadedPhylorefs: [],
      openTreeTaxonomyInfoByName: {},
    };
  },
  computed: {
    phylorefsWithMoreThanOneSpecifier() {
      return this.loadedPhylorefs.filter(phyloref => (this.getSpecifiersForPhyloref(phyloref) || []).length > 1);
    },
    phylorefsWithEveryOTTIds() {
      return this.loadedPhylorefs.filter(phyloref => {
        const specifiers = this.getSpecifiersForPhyloref(phyloref);
        if(specifiers.length > 0 &&
          specifiers.length === specifiers.filter(specifier => this.getOpenTreeTaxonomyID(specifier) !== undefined).length
        ) return true;
      });
    },
    exampleJSONLDURLs() { return [
      // Returns a list of example files to display in the "Examples" menu.
      {
        url: 'examples/fisher_et_al_2007.jsonld',
        title: 'Fisher et al, 2007',
      },
      {
        url: 'examples/brochu_2003.jsonld',
        title: 'Brochu 2003',
      },
    ]},
    allSpecifiers() {
      return this.loadedPhylorefs.map(phyloref => this.getSpecifiers(phyloref)).reduce((acc, val) => acc.concat(val), []);
    },
    ottIdsForAllSpecifiers() {
      // Assumes that queryOpenTreeTaxonomyIDs has already been called!
      const ottIds = this.allSpecifiers.map(specifier => this.getOpenTreeTaxonomyID(specifier))
        .filter(x => x !== undefined && x !== null);

      return ottIds;
    },
  },
  methods: {
    getScinameForSpecifier(specifier) {
      const label = this.getLabelForSpecifier(specifier);

      // TODO Fix hack.
      const match = /^(?:includes|excludes) scientific name (\w+) (?:\(originally \w+\)\s+)?([\w\-]+)\b/.exec(label);
      if(match) {
        return `${match[1]} ${match[2]}`
      }

      return undefined;
    },
    getOpenTreeTaxonomyID(specifier) {
      const matches = this.openTreeTaxonomyInfoByName[this.getScinameForSpecifier(specifier)];

      if(matches && matches.length > 0) {
        return matches[0]['taxon']['ott_id'];
      }
    },
    getSpecifiers(phyloref) {
      if(phyloref === undefined) return { internalTUs: [], externalTUs: [], allTUs: [] };

      // Returns a list of TUs for a particular phyloreference.
      return this.getSpecifiersForPhyloref(phyloref);
    },

    loadJSONLDFromURL(url) {
      // Change the current PHYX to that in the provided URL.
      // Will ask the user to confirm before replacing it.

      $.getJSON(url)
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

          this.extractPhyloreferencesFromJSONLD(jsonld);
        });
        fr.readAsText(file);
      }
    },

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

          // We don't know which flags lead to taxa being suppressed from the
          // synthetic tree (see
          // https://github.com/OpenTreeOfLife/reference-taxonomy/blob/master/doc/taxon-flags.md#flags-leading-to-taxa-being-suppressed-from-the-synthetic-tree
          // ), but we do know some flags that *don't* lead to taxa being suppressed
          // from the synthetic tree, so let's remove those from the flags.
          const flagsIndicatingSuppression = flags
            .filter(fl => fl !== 'SIBLING_HIGHER')

          if(flagsIndicatingSuppression.length > 0) {
            console.log("Ignoring", name, "because of flags:", flagsIndicatingSuppression);
            return;
          }

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

    addPhyloref(phyloref) {
      // Check to make sure this phyloref hasn't already been added.
      if(this.loadedPhylorefs.find(phy => isEqual(phy, phyloref)) !== undefined) return;

      // No previous match? Then add it in!
      this.loadedPhylorefs.push(phyloref);
    },

    extractPhyloreferencesFromJSONLD(jsonld) {
      // Extract phyloreferences from the provided JSONLD file and add them to
      // state.loaded. We use isEqual to prevent adding the same phyloreference
      // more than once, but we will add different phyloreferences with the
      // same '@id'.

      // JSON-LD files sometimes contain an array of elements. In this case,
      // we should try adding every one.
      if(Array.isArray(jsonld)) {
        jsonld.forEach(element => this.extractPhyloreferencesFromJSONLD(element));
      }

      // If this was generated by the Authoring Tool, then we can find phyloreferences
      // just by looking for jsonld.phylorefs.
      if(has(jsonld, 'phylorefs') && Array.isArray(jsonld.phylorefs)) {
        jsonld.phylorefs.forEach(phy => this.addPhyloref(phy));
      }

      // If it was created by phyx2ontology, the phyloreferences can be recognized
      // has having a subClassOf 'phyloref:Phyloreference'. Let's look for that.
      if(has(jsonld, 'subClassOf')) {
        if(Array.isArray(jsonld.subClassOf) && jsonld.subClassOf.includes('phyloref:Phyloreference'))
          this.addPhyloref(jsonld);
        if(jsonld.subClassOf === 'phyloref:Phyloreference')
          this.addPhyloref(jsonld);
      }
    },

    getSpecifiersFromClassExpression(classExpr) {
      let results = [];

      // If classExpr is an array, then process each entry separately.
      if(Array.isArray(classExpr)) {
        return classExpr
          .map(expr => getSpecifiersFromClassExpression(expr))
          .reduce((acc, val) => acc.concat(val), []);
      }

      // If classExpr itself has an equivalentClass, then we should process that instead.
      if(has(classExpr, 'equivalentClass')) {
        results = results.concat(getSpecifiersFromClassExpression(classExpr.equivalentClass));
      }

      // If there are additional classes, then process those too.
      if(has(classExpr, 'hasAdditionalClass')) {
        results = results.concat(getSpecifiersFromClassExpression(classExpr.hasAdditionalClass));
      }

      if(getLabelForSpecifier(classExpr) !== undefined) {
        results.push(classExpr);
      } else {
        if(has(classExpr, 'someValuesFrom')) {
          results = results.concat(getSpecifiersFromClassExpression(classExpr.someValuesFrom));
        }

        if(has(classExpr, 'intersectionOf')) {
          results = results.concat(getSpecifiersFromClassExpression(classExpr.intersectionOf));
        }
      }

      return results;
    },

    getLabelForSpecifier(expr) {
      // Recognize the three standard expression forms.
      // Form 1. obo:CDAO_0000149 some (excludes_TU some ...) and (includes_TU some ...)
      if (
        has(expr, 'onProperty') && expr.onProperty === 'obo:CDAO_0000149' &&
        has(expr, 'someValuesFrom') && has(expr.someValuesFrom, 'intersectionOf')
      ) {
        // There are two possibilities here. We could be looking at the MRCA of two TUs,
        // or we could be looking at the MRCA of one MRCA and one TU. So figure out which
        // it is.
        if(expr.someValuesFrom.intersectionOf.length === 2
          && has(expr.someValuesFrom.intersectionOf[0], 'onProperty') && expr.someValuesFrom.intersectionOf[0].onProperty === 'phyloref:excludes_TU'
          && has(expr.someValuesFrom.intersectionOf[1], 'onProperty') && expr.someValuesFrom.intersectionOf[1].onProperty === 'phyloref:includes_TU'
        ) {
          // Two-TU MRCA!
          const comp1 = this.getLabelForSpecifierExpr(expr.someValuesFrom.intersectionOf[0]);
          const comp2 = this.getLabelForSpecifierExpr(expr.someValuesFrom.intersectionOf[1]);

          return `MRCA(${comp1.substr(25)}, ${comp2.substr(25)})`;
        } else if(
          expr.someValuesFrom.intersectionOf.length === 2
          && has(expr.someValuesFrom.intersectionOf[0], 'onProperty') && expr.someValuesFrom.intersectionOf[0].onProperty === 'phyloref:excludes_lineage_to'
        ) {
          return undefined;
        } else {
          // No idea what this is!
          return undefined;
        }
      }

      // Form 2. includes_TU some (Name and scientificName some X)
      else if (
          (has(expr, 'onProperty') && expr.onProperty === 'phyloref:includes_TU') &&
          (has(expr, 'someValuesFrom') && (
            (has(expr.someValuesFrom, 'onProperty') && expr.someValuesFrom.onProperty === 'http://rs.tdwg.org/ontology/voc/TaxonConcept#hasName') &&
            (has(expr.someValuesFrom, 'someValuesFrom') &&
              (has(expr.someValuesFrom.someValuesFrom, 'intersectionOf')) &&
              (has(expr.someValuesFrom.someValuesFrom.intersectionOf[1], 'onProperty') &&
                expr.someValuesFrom.someValuesFrom.intersectionOf[1].onProperty === 'dwc:scientificName')
            )
          )
        )
      ) {
          return `includes scientific name ${expr.someValuesFrom.someValuesFrom.intersectionOf[1].hasValue}`;
          // return JSON.stringify(expr);
      }
      // Form 3. excludes_TU some (Name and scientificName some X)
      else if (
          (has(expr, 'onProperty') && expr.onProperty === 'phyloref:excludes_TU') &&
          (has(expr, 'someValuesFrom') && (
              (has(expr.someValuesFrom, 'onProperty') && expr.someValuesFrom.onProperty === 'http://rs.tdwg.org/ontology/voc/TaxonConcept#hasName') &&
              (has(expr.someValuesFrom, 'someValuesFrom') &&
                (has(expr.someValuesFrom.someValuesFrom, 'intersectionOf')) &&
                (has(expr.someValuesFrom.someValuesFrom.intersectionOf[1], 'onProperty') &&
                  expr.someValuesFrom.someValuesFrom.intersectionOf[1].onProperty === 'dwc:scientificName')
              )
          ))
      ) {
          return `excludes scientific name ${expr.someValuesFrom.someValuesFrom.intersectionOf[1].hasValue}`;
          // return JSON.stringify(expr);
      } else {
          // Could not match!
          return undefined;
      }
    },

    convertTaxonomicUnitToExpr(type) {
      return (tu) => {
        const property = `phyloref:${type}_TU`;

        if(!has(tu, 'referencesTaxonomicUnits')) return undefined;
        // Only use the first taxonomic unit!
        const tunit = tu.referencesTaxonomicUnits[0];
        // Scientific name?
        if (has(tunit, 'scientificNames')) {
          return {
            onProperty: property,
            someValuesFrom: {
              onProperty: 'http://rs.tdwg.org/ontology/voc/TaxonConcept#hasName',
              someValuesFrom: {
                intersectionOf: [
                  {
                    "@id": "obo:NOMEN_0000107"
                  },
                  {
                    onProperty: 'dwc:scientificName',
                    hasValue: tunit.scientificNames[0].scientificName
                  }
                ]
              }
            }
          };
        } else {
          // We don't support anything else!
          return undefined;
        }
      }
    },

    getSpecifiersForPhyloref(phyloref) {
      // phyloref: Phyloreference to retrieve specifiers from.
      //
      // All phyloref objects should have internal and external specifier
      // information. But first, let's see if we can extract it directly from
      // the equivalentClass statement.

      if(has(phyloref, 'internalSpecifiers')) {
        // Old form! Let's just extract the taxonomic units and go with that.
        const internals = (phyloref['internalSpecifiers'] || [])
          .map(this.convertTaxonomicUnitToExpr('includes'))
          .filter(tu => tu !== undefined);
        const externals = (phyloref['externalSpecifiers'] || [])
          .map(this.convertTaxonomicUnitToExpr('excludes'))
          .filter(tu => tu !== undefined);

        if(internals.length === 0) return [];
        if(externals.length === 0) {
          return internals;
        }
        return internals.concat(externals);
      }

      return uniqWith(
        this.getSpecifiersFromClassExpression(phyloref || []),
        isEqual
      );
    }
  }
};
</script>
