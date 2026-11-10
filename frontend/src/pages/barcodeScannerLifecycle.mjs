export function createBarcodeScannerLifecycle(
  scanner,
  { onError = () => {}, setTimer = setTimeout, clearTimer = clearTimeout } = {}
) {
  let timerId = null;
  let startPromise = null;
  let stopPromise = null;
  let clearPromise = null;
  let closed = false;
  let started = false;

  const clearScanner = () => {
    if (!clearPromise) {
      clearPromise = Promise.resolve()
        .then(() => scanner.clear?.())
        .catch(error => console.error('Scanner clear error:', error));
    }
    return clearPromise;
  };

  const stopScanner = () => {
    if (!stopPromise) {
      stopPromise = (async () => {
        if (started && typeof scanner.stop === 'function') {
          started = false;
          try {
            await scanner.stop();
          } catch (error) {
            console.error('Scanner stop error:', error);
          }
        }
        await clearScanner();
      })();
    }
    return stopPromise;
  };

  const close = async () => {
    closed = true;
    if (timerId !== null) {
      clearTimer(timerId);
      timerId = null;
    }
    if (startPromise) await startPromise;
    await stopScanner();
  };

  const scheduleStart = (cameraId, config, onDecoded, delay = 300) => {
    if (closed || timerId !== null || startPromise) return false;
    timerId = setTimer(() => {
      timerId = null;
      if (closed) return;

      startPromise = (async () => {
        try {
          started = true;
          await scanner.start(
            cameraId,
            config,
            decodedText => {
              if (closed) return;
              close().then(() => onDecoded(decodedText));
            },
            () => {}
          );
          if (closed) await stopScanner();
        } catch (error) {
          if (!closed) {
            await stopScanner();
            onError(error);
          }
        }
      })();
    }, delay);
    return true;
  };

  return { close, scheduleStart };
}
