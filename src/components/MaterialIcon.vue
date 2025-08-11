<template>
  <span 
    class="material-symbols-outlined"
    :class="[size, weight, fill, grade, opticalSize]"
    :style="{ fontSize: customSize }"
  >
    {{ icon }}
  </span>
</template>

<script setup lang="ts">
interface Props {
  icon: string;
  size?: 'text-xs' | 'text-sm' | 'text-base' | 'text-lg' | 'text-xl' | 'text-2xl' | 'text-3xl' | 'text-4xl' | 'text-5xl' | 'text-6xl';
  weight?: 'font-thin' | 'font-extralight' | 'font-light' | 'font-normal' | 'font-medium' | 'font-semibold' | 'font-bold' | 'font-extrabold' | 'font-black';
  fill?: 'fill-0' | 'fill-1';
  grade?: 'grade--25' | 'grade-0' | 'grade-200';
  opticalSize?: 'opsz-20' | 'opsz-24' | 'opsz-40' | 'opsz-48';
  customSize?: string;
}

withDefaults(defineProps<Props>(), {
  size: 'text-base',
  weight: 'font-normal',
  fill: 'fill-0',
  grade: 'grade-0',
  opticalSize: 'opsz-24'
});
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');

.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
  user-select: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Fill variations */
.fill-0 {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
}

.fill-1 {
  font-variation-settings:
    'FILL' 1,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
}

/* Weight variations */
.font-thin {
  font-variation-settings:
    'FILL' 0,
    'wght' 100,
    'GRAD' 0,
    'opsz' 24;
}

.font-extralight {
  font-variation-settings:
    'FILL' 0,
    'wght' 200,
    'GRAD' 0,
    'opsz' 24;
}

.font-light {
  font-variation-settings:
    'FILL' 0,
    'wght' 300,
    'GRAD' 0,
    'opsz' 24;
}

.font-normal {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
}

.font-medium {
  font-variation-settings:
    'FILL' 0,
    'wght' 500,
    'GRAD' 0,
    'opsz' 24;
}

.font-semibold {
  font-variation-settings:
    'FILL' 0,
    'wght' 600,
    'GRAD' 0,
    'opsz' 24;
}

.font-bold {
  font-variation-settings:
    'FILL' 0,
    'wght' 700,
    'GRAD' 0,
    'opsz' 24;
}

/* Grade variations */
.grade--25 {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' -25,
    'opsz' 24;
}

.grade-0 {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
}

.grade-200 {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 200,
    'opsz' 24;
}

/* Optical size variations */
.opsz-20 {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 20;
}

.opsz-24 {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
}

.opsz-40 {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 40;
}

.opsz-48 {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 48;
}
</style>