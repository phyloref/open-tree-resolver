<template>
  <div id="app">
    <TopNavigationBar :version="OPEN_TREE_RESOLVER_VERSION" />
    <div id="wrapper">
      <PhylorefTable />
    </div>

    <!-- All modals are included here -->
    <AboutOpenTreeResolverModal />
  </div>
</template>

<script>
/*
 * Lays out the entire page, including inserting the (hidden) modals so they can be displayed.
 */

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
    OPEN_TREE_RESOLVER_VERSION: "0.1.0",
  }},
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
