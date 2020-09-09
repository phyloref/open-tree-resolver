<template>
  <div>
    <!-- Navigation bar at the top of the page -->
    <nav class="navbar navbar-expand navbar-dark bg-dark mb-2 fixed-top">
      <a class="navbar-brand" href="./index.html" style="margin-right: 0.2em;">Open Tree Resolver</a>
      <a class="navbar-brand" :href="versionURL" target="_blank"><small>{{ versionString }}</small></a>
      <div class="collapse navbar-collapse">
        <ul class="navbar-nav">
          <li class="nav-item">
            <a
              class="nav-link"
              href="#"
              onclick="$('#about-open-tree-resolver').modal()"
            >
              About this tool
            </a>
          </li>
          <li class="nav-item">
            <a
              class="nav-link"
              href="https://www.phyloref.org/"
            >
              Phyloreferencing website
            </a>
          </li>
          <li class="nav-item">
            <a
              class="nav-link"
              href="https://github.com/phyloref/open-tree-resolver"
            >
              Github repository
            </a>
          </li>
          <li class="nav-item">
            <a
              class="nav-link"
              href="https://github.com/phyloref/open-tree-resolver/issues"
            >
              Report bug
            </a>
          </li>
        </ul>
      </div>
    </nav>
  </div>
</template>

<script>

/*
 * The top navigation bar provides links to Phyloreferencing resources,
 * the about-us modal, and a link to report bugs.
 */

export default {
  name: 'TopNavigationBar',
  props: {
    version: {
      type: String,
    },
  },
  computed: {
    versionString() {
      if (!this.version) return "";
      if (this.version.startsWith("refs/tags/")) {
        return this.version.substr(10);
      }
      return this.version;
    },
    versionURL() {
      if (!this.version) return undefined;
      if (this.version.startsWith("refs/tags/")) {
        return "https://github.com/phyloref/open-tree-resolver/releases/tag/" + this.version.substr(10);
      }
      return undefined;
    }
  }
};
</script>
