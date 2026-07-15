<script setup lang="ts">
import { useData, withBase } from "vitepress";

// Derived at build time in config.ts (buildCurriculum) — one entry per chapter, each
// with the first-lesson link per engine. Links come straight from the sidebar arrays,
// so the docs:build dead-link gate covers every one.
const { theme } = useData();
const curriculum = theme.value.curriculum ?? [];
</script>

<template>
  <section v-if="curriculum.length" class="home-curriculum">
    <div class="curriculum-inner">
      <div class="home-block-head">
        <h2>The curriculum</h2>
        <p>Eight chapters, each proven against PostgreSQL and MySQL. Pick a database and start anywhere.</p>
      </div>
      <ul class="curriculum-grid">
        <li v-for="c in curriculum" :key="c.chapter" class="curriculum-card">
          <span class="curriculum-label">{{ c.label }}</span>
          <span class="curriculum-links">
            <a :href="withBase(c.postgres)">PostgreSQL</a>
            <a :href="withBase(c.mysql)">MySQL</a>
          </span>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
/* Mirror VitePress's own home containers (VPHero/VPFeatures): the horizontal gutter
   is responsive outer padding, and an inner 1152px block is centered inside it — so
   the grid lines up edge-to-edge with the hero and the feature cards at every width. */
/* No bottom padding: VitePress's .VPHome already carries a 128px margin-bottom to the
   footer, so adding our own here just doubled the gap below the grid. */
.home-curriculum {
  padding: 48px 24px 0;
  margin-top: 16px;
}

@media (min-width: 640px) {
  .home-curriculum {
    padding-left: 48px;
    padding-right: 48px;
  }
}

@media (min-width: 960px) {
  .home-curriculum {
    padding-left: 64px;
    padding-right: 64px;
    margin-top: 40px;
  }
}

.curriculum-inner {
  max-width: 1152px;
  margin: 0 auto;
}

.home-block-head h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.home-block-head p {
  margin: 8px 0 24px;
  color: var(--vp-c-text-2);
}

.curriculum-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
  list-style: none;
  padding: 0;
  margin: 0;
}

.curriculum-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  transition: border-color 0.25s;
}

.curriculum-card:hover {
  border-color: var(--vp-c-brand-1);
}

.curriculum-label {
  font-weight: 600;
  font-size: 15px;
}

.curriculum-links {
  display: flex;
  gap: 8px;
}

.curriculum-links a {
  flex: 1;
  padding: 6px 10px;
  text-align: center;
  font-size: 13px;
  font-weight: 500;
  border-radius: 8px;
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-1);
  transition: background-color 0.25s, color 0.25s;
}

.curriculum-links a:hover {
  background: var(--vp-c-brand-1);
  color: var(--vp-c-white);
}
</style>
