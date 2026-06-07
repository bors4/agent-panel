/**
 * Точка входа Vue приложения.
 * Монтирует корневой компонент в #app. State хранится в композаблах
 * (см. src/composables/) + localStorage; Pinia не используется.
 * @module main
 */

import { createApp } from "vue";
import App from "./App.vue";
import "./styles/main.css";

const app = createApp(App);
app.mount("#app");
