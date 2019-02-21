<template>
  <div id="app">
    <TopNavigationBar :version="OPEN_TREE_RESOLVER_VERSION" />
    <div id="wrapper">
      <p>Hello, world</p>
    </div>

    <!-- All modals are included here -->
    <AboutOpenTreeResolverModal />
  </div>
</template>

<script>
/*
 * Lays out the entire page, including inserting the (hidden) modals so they can be displayed.
 */

import { isEqual } from 'lodash';
import { mapState } from 'vuex';

// Navigation controls.
import TopNavigationBar from './components/TopNavigationBar.vue';

// Modal dialogs to be displayed above the UI.
import AboutOpenTreeResolverModal from './components/modals/AboutOpenTreeResolverModal.vue';

export default {
  name: 'App',
  components: {
    TopNavigationBar,
    AboutOpenTreeResolverModal,
  },
  data: function() { return {
    OPEN_TREE_RESOLVER_VERSION: "0.1.0",
  }},
  created() {
    // If someone tries to navigate away from the window while the
    // PHYX has been modified, ask users to confirm before leaving.
    // Confirmation message to display to the user. Note that modern
    // browsers do not display this message, but provide a generic
    // "content has changed" dialog instead.
    $(window).on('beforeunload', () => {
      const confirmationMessage = 'Your modifications have not been saved and will be lost if you close the Curation Tool. Confirm to discard your changes, or cancel to return to the Curation Tool.';

      // if (!isEqual(this.loadedPhyx, this.currentPhyx)) return confirmationMessage;
      return false;
    });
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
