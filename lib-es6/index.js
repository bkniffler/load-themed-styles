/**
 * An IThemingInstruction can specify a rawString to be preserved or a theme slot and a default value
 * to use if that slot is not specified by the theme.
 */
var __assign =
  (this && this.__assign) ||
  function() {
    __assign =
      Object.assign ||
      function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s)
            if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
      };
    return __assign.apply(this, arguments);
  };
// IE needs to inject styles using cssText. However, we need to evaluate this lazily, so this
// value will initialize as undefined, and later will be set once on first loadStyles injection.
var _injectStylesWithCssText;
// Store the theming state in __themeState__ global scope for reuse in the case of duplicate
// load-themed-styles hosted on the page.
var _root = typeof window === 'undefined' ? global : window; // tslint:disable-line:no-any
var _themeState = initializeThemeState();
/**
 * Matches theming tokens. For example, "[theme: themeSlotName, default: #FFF]" (including the quotes).
 */
// tslint:disable-next-line:max-line-length
var _themeTokenRegex = /[\'\"]\[theme:\s*(\w+)\s*(?:\,\s*default:\s*([\\"\']?[\.\,\(\)\#\-\s\w]*[\.\,\(\)\#\-\w][\"\']?))?\s*\][\'\"]/g;
/** Maximum style text length, for supporting IE style restrictions. */
var MAX_STYLE_CONTENT_SIZE = 10000;
var now = function() {
  return typeof performance !== 'undefined' && !!performance.now
    ? performance.now()
    : Date.now();
};
function measure(func) {
  var start = now();
  func();
  var end = now();
  _themeState.perf.duration += end - start;
}
/**
 * initialize global state object
 */
function initializeThemeState() {
  var state = _root.__themeState__ || {
    theme: undefined,
    lastStyleElement: undefined,
    registeredStyles: []
  };
  if (!state.runState) {
    state = __assign({}, state, {
      perf: {
        count: 0,
        duration: 0
      },
      runState: {
        flushTimer: 0,
        mode: 0 /* sync */,
        buffer: []
      }
    });
  }
  if (!state.registeredThemableStyles) {
    state = __assign({}, state, { registeredThemableStyles: [] });
  }
  _root.__themeState__ = state;
  return state;
}
/**
 * Loads a set of style text. If it is registered too early, we will register it when the window.load
 * event is fired.
 * @param {string | ThemableArray} styles Themable style text to register.
 * @param {boolean} loadAsync When true, always load styles in async mode, irrespective of current sync mode.
 */
export function loadStyles(styles, loadAsync) {
  if (typeof document === 'undefined') {
    return;
  }
  if (loadAsync === void 0) {
    loadAsync = false;
  }
  measure(function() {
    var styleParts = Array.isArray(styles) ? styles : splitStyles(styles);
    if (_injectStylesWithCssText === undefined) {
      _injectStylesWithCssText = shouldUseCssText();
    }
    var _a = _themeState.runState,
      mode = _a.mode,
      buffer = _a.buffer,
      flushTimer = _a.flushTimer;
    if (loadAsync || mode === 1 /* async */) {
      buffer.push(styleParts);
      if (!flushTimer) {
        _themeState.runState.flushTimer = asyncLoadStyles();
      }
    } else {
      applyThemableStyles(styleParts);
    }
  });
}
/**
 * Allows for customizable loadStyles logic. e.g. for server side rendering application
 * @param {(processedStyles: string, rawStyles?: string | ThemableArray) => void}
 * a loadStyles callback that gets called when styles are loaded or reloaded
 */
export function configureLoadStyles(loadStylesFn) {
  _themeState.loadStyles = loadStylesFn;
}
/**
 * Configure run mode of load-themable-styles
 * @param mode load-themable-styles run mode, async or sync
 */
export function configureRunMode(mode) {
  _themeState.runState.mode = mode;
}
/**
 * external code can call flush to synchronously force processing of currently buffered styles
 */
export function flush() {
  measure(function() {
    var styleArrays = _themeState.runState.buffer.slice();
    _themeState.runState.buffer = [];
    var mergedStyleArray = [].concat.apply([], styleArrays);
    if (mergedStyleArray.length > 0) {
      applyThemableStyles(mergedStyleArray);
    }
  });
}
/**
 * register async loadStyles
 */
function asyncLoadStyles() {
  return setTimeout(function() {
    _themeState.runState.flushTimer = 0;
    flush();
  }, 0);
}
/**
 * Loads a set of style text. If it is registered too early, we will register it when the window.load event
 * is fired.
 * @param {string} styleText Style to register.
 * @param {IStyleRecord} styleRecord Existing style record to re-apply.
 */
function applyThemableStyles(stylesArray, styleRecord) {
  if (_themeState.loadStyles) {
    _themeState.loadStyles(
      resolveThemableArray(stylesArray).styleString,
      stylesArray
    );
  } else {
    _injectStylesWithCssText
      ? registerStylesIE(stylesArray, styleRecord)
      : registerStyles(stylesArray);
  }
}
/**
 * Registers a set theme tokens to find and replace. If styles were already registered, they will be
 * replaced.
 * @param {theme} theme JSON object of theme tokens to values.
 */
export function loadTheme(theme) {
  _themeState.theme = theme;
  // reload styles.
  reloadStyles();
}
/**
 * Clear already registered style elements and style records in theme_State object
 * @option: specify which group of registered styles should be cleared.
 * Default to be both themable and non-themable styles will be cleared
 */
export function clearStyles(option) {
  if (option === void 0) {
    option = 3 /* all */;
  }
  if (option === 3 /* all */ || option === 2 /* onlyNonThemable */) {
    clearStylesInternal(_themeState.registeredStyles);
    _themeState.registeredStyles = [];
  }
  if (option === 3 /* all */ || option === 1 /* onlyThemable */) {
    clearStylesInternal(_themeState.registeredThemableStyles);
    _themeState.registeredThemableStyles = [];
  }
}
function clearStylesInternal(records) {
  records.forEach(function(styleRecord) {
    var styleElement = styleRecord && styleRecord.styleElement;
    if (styleElement && styleElement.parentElement) {
      styleElement.parentElement.removeChild(styleElement);
    }
  });
}
/**
 * Reloads styles.
 */
function reloadStyles() {
  if (_themeState.theme) {
    var themableStyles = [];
    for (
      var _i = 0, _a = _themeState.registeredThemableStyles;
      _i < _a.length;
      _i++
    ) {
      var styleRecord = _a[_i];
      themableStyles.push(styleRecord.themableStyle);
    }
    if (themableStyles.length > 0) {
      clearStyles(1 /* onlyThemable */);
      applyThemableStyles([].concat.apply([], themableStyles));
    }
  }
}
/**
 * Find theme tokens and replaces them with provided theme values.
 * @param {string} styles Tokenized styles to fix.
 */
export function detokenize(styles) {
  if (styles) {
    styles = resolveThemableArray(splitStyles(styles)).styleString;
  }
  return styles;
}
/**
 * Resolves ThemingInstruction objects in an array and joins the result into a string.
 * @param {ThemableArray} splitStyleArray ThemableArray to resolve and join.
 */
function resolveThemableArray(splitStyleArray) {
  var theme = _themeState.theme;
  var themable = false;
  // Resolve the array of theming instructions to an array of strings.
  // Then join the array to produce the final CSS string.
  var resolvedArray = (splitStyleArray || []).map(function(currentValue) {
    var themeSlot = currentValue.theme;
    if (themeSlot) {
      themable = true;
      // A theming annotation. Resolve it.
      var themedValue = theme ? theme[themeSlot] : undefined;
      var defaultValue = currentValue.defaultValue || 'inherit';
      // Warn to console if we hit an unthemed value even when themes are provided, but only if "DEBUG" is true.
      // Allow the themedValue to be undefined to explicitly request the default value.
      if (
        theme &&
        !themedValue &&
        console &&
        !(themeSlot in theme) &&
        typeof DEBUG !== 'undefined' &&
        DEBUG
      ) {
        console.warn(
          'Theming value not provided for "' +
            themeSlot +
            '". Falling back to "' +
            defaultValue +
            '".'
        );
      }
      return themedValue || defaultValue;
    } else {
      // A non-themable string. Preserve it.
      return currentValue.rawString;
    }
  });
  return {
    styleString: resolvedArray.join(''),
    themable: themable
  };
}
/**
 * Split tokenized CSS into an array of strings and theme specification objects
 * @param {string} styles Tokenized styles to split.
 */
export function splitStyles(styles) {
  var result = [];
  if (styles) {
    var pos = 0; // Current position in styles.
    var tokenMatch = void 0; // tslint:disable-line:no-null-keyword
    while ((tokenMatch = _themeTokenRegex.exec(styles))) {
      var matchIndex = tokenMatch.index;
      if (matchIndex > pos) {
        result.push({
          rawString: styles.substring(pos, matchIndex)
        });
      }
      result.push({
        theme: tokenMatch[1],
        defaultValue: tokenMatch[2] // May be undefined
      });
      // index of the first character after the current match
      pos = _themeTokenRegex.lastIndex;
    }
    // Push the rest of the string after the last match.
    result.push({
      rawString: styles.substring(pos)
    });
  }
  return result;
}
/**
 * Registers a set of style text. If it is registered too early, we will register it when the
 * window.load event is fired.
 * @param {ThemableArray} styleArray Array of IThemingInstruction objects to register.
 * @param {IStyleRecord} styleRecord May specify a style Element to update.
 */
function registerStyles(styleArray) {
  if (typeof document === 'undefined') {
    return;
  }
  var head = document.getElementsByTagName('head')[0];
  var styleElement = document.createElement('style');
  var _a = resolveThemableArray(styleArray),
    styleString = _a.styleString,
    themable = _a.themable;
  styleElement.type = 'text/css';
  styleElement.appendChild(document.createTextNode(styleString));
  _themeState.perf.count++;
  head.appendChild(styleElement);
  var record = {
    styleElement: styleElement,
    themableStyle: styleArray
  };
  if (themable) {
    _themeState.registeredThemableStyles.push(record);
  } else {
    _themeState.registeredStyles.push(record);
  }
}
/**
 * Registers a set of style text, for IE 9 and below, which has a ~30 style element limit so we need
 * to register slightly differently.
 * @param {ThemableArray} styleArray Array of IThemingInstruction objects to register.
 * @param {IStyleRecord} styleRecord May specify a style Element to update.
 */
function registerStylesIE(styleArray, styleRecord) {
  var head = document.getElementsByTagName('head')[0];
  var registeredStyles = _themeState.registeredStyles;
  var lastStyleElement = _themeState.lastStyleElement;
  var stylesheet = lastStyleElement ? lastStyleElement.styleSheet : undefined;
  var lastStyleContent = stylesheet ? stylesheet.cssText : '';
  var lastRegisteredStyle = registeredStyles[registeredStyles.length - 1];
  var resolvedStyleText = resolveThemableArray(styleArray).styleString;
  if (
    !lastStyleElement ||
    lastStyleContent.length + resolvedStyleText.length > MAX_STYLE_CONTENT_SIZE
  ) {
    lastStyleElement = document.createElement('style');
    lastStyleElement.type = 'text/css';
    if (styleRecord) {
      head.replaceChild(lastStyleElement, styleRecord.styleElement);
      styleRecord.styleElement = lastStyleElement;
    } else {
      head.appendChild(lastStyleElement);
    }
    if (!styleRecord) {
      lastRegisteredStyle = {
        styleElement: lastStyleElement,
        themableStyle: styleArray
      };
      registeredStyles.push(lastRegisteredStyle);
    }
  }
  lastStyleElement.styleSheet.cssText += detokenize(resolvedStyleText);
  Array.prototype.push.apply(lastRegisteredStyle.themableStyle, styleArray); // concat in-place
  // Preserve the theme state.
  _themeState.lastStyleElement = lastStyleElement;
}
/**
 * Checks to see if styleSheet exists as a property off of a style element.
 * This will determine if style registration should be done via cssText (<= IE9) or not
 */
function shouldUseCssText() {
  var useCSSText = false;
  if (typeof document !== 'undefined') {
    var emptyStyle = document.createElement('style');
    emptyStyle.type = 'text/css';
    useCSSText = !!emptyStyle.styleSheet;
  }
  return useCSSText;
}
//# sourceMappingURL=index.js.map
