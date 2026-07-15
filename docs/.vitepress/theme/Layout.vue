<script setup lang="ts">
import DefaultTheme from "vitepress/theme";
import HomeCurriculum from "./components/HomeCurriculum.vue";
import HomeHeroVisual from "./components/HomeHeroVisual.vue";

const { Layout } = DefaultTheme;
</script>

<template>
  <Layout>
    <template #home-hero-image>
      <HomeHeroVisual />
    </template>
    <template #home-features-after>
      <HomeCurriculum />
    </template>
  </Layout>
</template>
