/**
 * Точка входа Vue приложения.
 * Инициализирует приложение с Pinia и монтирует в #app.
 * @module main
 */

import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import "./styles/main.css";

const app = createApp(App);
app.use(createPinia());
app.mount("#app");
