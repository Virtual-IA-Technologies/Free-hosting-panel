/* End the boot guard only after all synchronous shell enhancements have run. */
(() => {
  clearTimeout(window.vipBootTimer);
  window.vipFormatDates?.();
  if (!document.body.classList.contains('via-shell')) document.body.classList.add('vip-native-fallback');
})();
