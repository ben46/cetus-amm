
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run$1(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run$1);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function select_option(select, value, mounting) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
        if (!mounting || value !== undefined) {
            select.selectedIndex = -1; // no option should be selected
        }
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked');
        return selected_option && selected_option.__value;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    /**
     * Schedules a callback to run immediately before the component is unmounted.
     *
     * Out of `onMount`, `beforeUpdate`, `afterUpdate` and `onDestroy`, this is the
     * only one that runs inside a server-side component.
     *
     * https://svelte.dev/docs#run-time-svelte-ondestroy
     */
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    /**
     * Creates an event dispatcher that can be used to dispatch [component events](/docs#template-syntax-component-directives-on-eventname).
     * Event dispatchers are functions that can take two arguments: `name` and `detail`.
     *
     * Component events created with `createEventDispatcher` create a
     * [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent).
     * These events do not [bubble](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events#Event_bubbling_and_capture).
     * The `detail` argument corresponds to the [CustomEvent.detail](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/detail)
     * property and can contain any type of data.
     *
     * https://svelte.dev/docs#run-time-svelte-createeventdispatcher
     */
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail, { cancelable = false } = {}) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail, { cancelable });
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
                return !event.defaultPrevented;
            }
            return true;
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }

    function destroy_block(block, lookup) {
        block.d(1);
        lookup.delete(block.key);
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        const updates = [];
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                // defer updates until all the DOM shuffling is done
                updates.push(() => block.p(child_ctx, dirty));
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        run_all(updates);
        return new_blocks;
    }
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error('Cannot have duplicate keys in a keyed each');
            }
            keys.add(key);
        }
    }

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run$1).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.2' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function getAugmentedNamespace(n) {
    	if (n.__esModule) return n;
    	var a = Object.defineProperty({}, '__esModule', {value: true});
    	Object.keys(n).forEach(function (k) {
    		var d = Object.getOwnPropertyDescriptor(n, k);
    		Object.defineProperty(a, k, d.get ? d : {
    			enumerable: true,
    			get: function () {
    				return n[k];
    			}
    		});
    	});
    	return a;
    }

    function createCommonjsModule(fn) {
      var module = { exports: {} };
    	return fn(module, module.exports), module.exports;
    }

    function commonjsRequire (target) {
    	throw new Error('Could not dynamically require "' + target + '". Please configure the dynamicRequireTargets option of @rollup/plugin-commonjs appropriately for this require call to behave properly.');
    }

    var _nodeResolve_empty = {};

    var _nodeResolve_empty$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        'default': _nodeResolve_empty
    });

    var require$$0 = /*@__PURE__*/getAugmentedNamespace(_nodeResolve_empty$1);

    var naclFast = createCommonjsModule(function (module) {
    (function(nacl) {

    // Ported in 2014 by Dmitry Chestnykh and Devi Mandiri.
    // Public domain.
    //
    // Implementation derived from TweetNaCl version 20140427.
    // See for details: http://tweetnacl.cr.yp.to/

    var gf = function(init) {
      var i, r = new Float64Array(16);
      if (init) for (i = 0; i < init.length; i++) r[i] = init[i];
      return r;
    };

    //  Pluggable, initialized in high-level API below.
    var randombytes = function(/* x, n */) { throw new Error('no PRNG'); };

    var _0 = new Uint8Array(16);
    var _9 = new Uint8Array(32); _9[0] = 9;

    var gf0 = gf(),
        gf1 = gf([1]),
        _121665 = gf([0xdb41, 1]),
        D = gf([0x78a3, 0x1359, 0x4dca, 0x75eb, 0xd8ab, 0x4141, 0x0a4d, 0x0070, 0xe898, 0x7779, 0x4079, 0x8cc7, 0xfe73, 0x2b6f, 0x6cee, 0x5203]),
        D2 = gf([0xf159, 0x26b2, 0x9b94, 0xebd6, 0xb156, 0x8283, 0x149a, 0x00e0, 0xd130, 0xeef3, 0x80f2, 0x198e, 0xfce7, 0x56df, 0xd9dc, 0x2406]),
        X = gf([0xd51a, 0x8f25, 0x2d60, 0xc956, 0xa7b2, 0x9525, 0xc760, 0x692c, 0xdc5c, 0xfdd6, 0xe231, 0xc0a4, 0x53fe, 0xcd6e, 0x36d3, 0x2169]),
        Y = gf([0x6658, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666]),
        I = gf([0xa0b0, 0x4a0e, 0x1b27, 0xc4ee, 0xe478, 0xad2f, 0x1806, 0x2f43, 0xd7a7, 0x3dfb, 0x0099, 0x2b4d, 0xdf0b, 0x4fc1, 0x2480, 0x2b83]);

    function ts64(x, i, h, l) {
      x[i]   = (h >> 24) & 0xff;
      x[i+1] = (h >> 16) & 0xff;
      x[i+2] = (h >>  8) & 0xff;
      x[i+3] = h & 0xff;
      x[i+4] = (l >> 24)  & 0xff;
      x[i+5] = (l >> 16)  & 0xff;
      x[i+6] = (l >>  8)  & 0xff;
      x[i+7] = l & 0xff;
    }

    function vn(x, xi, y, yi, n) {
      var i,d = 0;
      for (i = 0; i < n; i++) d |= x[xi+i]^y[yi+i];
      return (1 & ((d - 1) >>> 8)) - 1;
    }

    function crypto_verify_16(x, xi, y, yi) {
      return vn(x,xi,y,yi,16);
    }

    function crypto_verify_32(x, xi, y, yi) {
      return vn(x,xi,y,yi,32);
    }

    function core_salsa20(o, p, k, c) {
      var j0  = c[ 0] & 0xff | (c[ 1] & 0xff)<<8 | (c[ 2] & 0xff)<<16 | (c[ 3] & 0xff)<<24,
          j1  = k[ 0] & 0xff | (k[ 1] & 0xff)<<8 | (k[ 2] & 0xff)<<16 | (k[ 3] & 0xff)<<24,
          j2  = k[ 4] & 0xff | (k[ 5] & 0xff)<<8 | (k[ 6] & 0xff)<<16 | (k[ 7] & 0xff)<<24,
          j3  = k[ 8] & 0xff | (k[ 9] & 0xff)<<8 | (k[10] & 0xff)<<16 | (k[11] & 0xff)<<24,
          j4  = k[12] & 0xff | (k[13] & 0xff)<<8 | (k[14] & 0xff)<<16 | (k[15] & 0xff)<<24,
          j5  = c[ 4] & 0xff | (c[ 5] & 0xff)<<8 | (c[ 6] & 0xff)<<16 | (c[ 7] & 0xff)<<24,
          j6  = p[ 0] & 0xff | (p[ 1] & 0xff)<<8 | (p[ 2] & 0xff)<<16 | (p[ 3] & 0xff)<<24,
          j7  = p[ 4] & 0xff | (p[ 5] & 0xff)<<8 | (p[ 6] & 0xff)<<16 | (p[ 7] & 0xff)<<24,
          j8  = p[ 8] & 0xff | (p[ 9] & 0xff)<<8 | (p[10] & 0xff)<<16 | (p[11] & 0xff)<<24,
          j9  = p[12] & 0xff | (p[13] & 0xff)<<8 | (p[14] & 0xff)<<16 | (p[15] & 0xff)<<24,
          j10 = c[ 8] & 0xff | (c[ 9] & 0xff)<<8 | (c[10] & 0xff)<<16 | (c[11] & 0xff)<<24,
          j11 = k[16] & 0xff | (k[17] & 0xff)<<8 | (k[18] & 0xff)<<16 | (k[19] & 0xff)<<24,
          j12 = k[20] & 0xff | (k[21] & 0xff)<<8 | (k[22] & 0xff)<<16 | (k[23] & 0xff)<<24,
          j13 = k[24] & 0xff | (k[25] & 0xff)<<8 | (k[26] & 0xff)<<16 | (k[27] & 0xff)<<24,
          j14 = k[28] & 0xff | (k[29] & 0xff)<<8 | (k[30] & 0xff)<<16 | (k[31] & 0xff)<<24,
          j15 = c[12] & 0xff | (c[13] & 0xff)<<8 | (c[14] & 0xff)<<16 | (c[15] & 0xff)<<24;

      var x0 = j0, x1 = j1, x2 = j2, x3 = j3, x4 = j4, x5 = j5, x6 = j6, x7 = j7,
          x8 = j8, x9 = j9, x10 = j10, x11 = j11, x12 = j12, x13 = j13, x14 = j14,
          x15 = j15, u;

      for (var i = 0; i < 20; i += 2) {
        u = x0 + x12 | 0;
        x4 ^= u<<7 | u>>>(32-7);
        u = x4 + x0 | 0;
        x8 ^= u<<9 | u>>>(32-9);
        u = x8 + x4 | 0;
        x12 ^= u<<13 | u>>>(32-13);
        u = x12 + x8 | 0;
        x0 ^= u<<18 | u>>>(32-18);

        u = x5 + x1 | 0;
        x9 ^= u<<7 | u>>>(32-7);
        u = x9 + x5 | 0;
        x13 ^= u<<9 | u>>>(32-9);
        u = x13 + x9 | 0;
        x1 ^= u<<13 | u>>>(32-13);
        u = x1 + x13 | 0;
        x5 ^= u<<18 | u>>>(32-18);

        u = x10 + x6 | 0;
        x14 ^= u<<7 | u>>>(32-7);
        u = x14 + x10 | 0;
        x2 ^= u<<9 | u>>>(32-9);
        u = x2 + x14 | 0;
        x6 ^= u<<13 | u>>>(32-13);
        u = x6 + x2 | 0;
        x10 ^= u<<18 | u>>>(32-18);

        u = x15 + x11 | 0;
        x3 ^= u<<7 | u>>>(32-7);
        u = x3 + x15 | 0;
        x7 ^= u<<9 | u>>>(32-9);
        u = x7 + x3 | 0;
        x11 ^= u<<13 | u>>>(32-13);
        u = x11 + x7 | 0;
        x15 ^= u<<18 | u>>>(32-18);

        u = x0 + x3 | 0;
        x1 ^= u<<7 | u>>>(32-7);
        u = x1 + x0 | 0;
        x2 ^= u<<9 | u>>>(32-9);
        u = x2 + x1 | 0;
        x3 ^= u<<13 | u>>>(32-13);
        u = x3 + x2 | 0;
        x0 ^= u<<18 | u>>>(32-18);

        u = x5 + x4 | 0;
        x6 ^= u<<7 | u>>>(32-7);
        u = x6 + x5 | 0;
        x7 ^= u<<9 | u>>>(32-9);
        u = x7 + x6 | 0;
        x4 ^= u<<13 | u>>>(32-13);
        u = x4 + x7 | 0;
        x5 ^= u<<18 | u>>>(32-18);

        u = x10 + x9 | 0;
        x11 ^= u<<7 | u>>>(32-7);
        u = x11 + x10 | 0;
        x8 ^= u<<9 | u>>>(32-9);
        u = x8 + x11 | 0;
        x9 ^= u<<13 | u>>>(32-13);
        u = x9 + x8 | 0;
        x10 ^= u<<18 | u>>>(32-18);

        u = x15 + x14 | 0;
        x12 ^= u<<7 | u>>>(32-7);
        u = x12 + x15 | 0;
        x13 ^= u<<9 | u>>>(32-9);
        u = x13 + x12 | 0;
        x14 ^= u<<13 | u>>>(32-13);
        u = x14 + x13 | 0;
        x15 ^= u<<18 | u>>>(32-18);
      }
       x0 =  x0 +  j0 | 0;
       x1 =  x1 +  j1 | 0;
       x2 =  x2 +  j2 | 0;
       x3 =  x3 +  j3 | 0;
       x4 =  x4 +  j4 | 0;
       x5 =  x5 +  j5 | 0;
       x6 =  x6 +  j6 | 0;
       x7 =  x7 +  j7 | 0;
       x8 =  x8 +  j8 | 0;
       x9 =  x9 +  j9 | 0;
      x10 = x10 + j10 | 0;
      x11 = x11 + j11 | 0;
      x12 = x12 + j12 | 0;
      x13 = x13 + j13 | 0;
      x14 = x14 + j14 | 0;
      x15 = x15 + j15 | 0;

      o[ 0] = x0 >>>  0 & 0xff;
      o[ 1] = x0 >>>  8 & 0xff;
      o[ 2] = x0 >>> 16 & 0xff;
      o[ 3] = x0 >>> 24 & 0xff;

      o[ 4] = x1 >>>  0 & 0xff;
      o[ 5] = x1 >>>  8 & 0xff;
      o[ 6] = x1 >>> 16 & 0xff;
      o[ 7] = x1 >>> 24 & 0xff;

      o[ 8] = x2 >>>  0 & 0xff;
      o[ 9] = x2 >>>  8 & 0xff;
      o[10] = x2 >>> 16 & 0xff;
      o[11] = x2 >>> 24 & 0xff;

      o[12] = x3 >>>  0 & 0xff;
      o[13] = x3 >>>  8 & 0xff;
      o[14] = x3 >>> 16 & 0xff;
      o[15] = x3 >>> 24 & 0xff;

      o[16] = x4 >>>  0 & 0xff;
      o[17] = x4 >>>  8 & 0xff;
      o[18] = x4 >>> 16 & 0xff;
      o[19] = x4 >>> 24 & 0xff;

      o[20] = x5 >>>  0 & 0xff;
      o[21] = x5 >>>  8 & 0xff;
      o[22] = x5 >>> 16 & 0xff;
      o[23] = x5 >>> 24 & 0xff;

      o[24] = x6 >>>  0 & 0xff;
      o[25] = x6 >>>  8 & 0xff;
      o[26] = x6 >>> 16 & 0xff;
      o[27] = x6 >>> 24 & 0xff;

      o[28] = x7 >>>  0 & 0xff;
      o[29] = x7 >>>  8 & 0xff;
      o[30] = x7 >>> 16 & 0xff;
      o[31] = x7 >>> 24 & 0xff;

      o[32] = x8 >>>  0 & 0xff;
      o[33] = x8 >>>  8 & 0xff;
      o[34] = x8 >>> 16 & 0xff;
      o[35] = x8 >>> 24 & 0xff;

      o[36] = x9 >>>  0 & 0xff;
      o[37] = x9 >>>  8 & 0xff;
      o[38] = x9 >>> 16 & 0xff;
      o[39] = x9 >>> 24 & 0xff;

      o[40] = x10 >>>  0 & 0xff;
      o[41] = x10 >>>  8 & 0xff;
      o[42] = x10 >>> 16 & 0xff;
      o[43] = x10 >>> 24 & 0xff;

      o[44] = x11 >>>  0 & 0xff;
      o[45] = x11 >>>  8 & 0xff;
      o[46] = x11 >>> 16 & 0xff;
      o[47] = x11 >>> 24 & 0xff;

      o[48] = x12 >>>  0 & 0xff;
      o[49] = x12 >>>  8 & 0xff;
      o[50] = x12 >>> 16 & 0xff;
      o[51] = x12 >>> 24 & 0xff;

      o[52] = x13 >>>  0 & 0xff;
      o[53] = x13 >>>  8 & 0xff;
      o[54] = x13 >>> 16 & 0xff;
      o[55] = x13 >>> 24 & 0xff;

      o[56] = x14 >>>  0 & 0xff;
      o[57] = x14 >>>  8 & 0xff;
      o[58] = x14 >>> 16 & 0xff;
      o[59] = x14 >>> 24 & 0xff;

      o[60] = x15 >>>  0 & 0xff;
      o[61] = x15 >>>  8 & 0xff;
      o[62] = x15 >>> 16 & 0xff;
      o[63] = x15 >>> 24 & 0xff;
    }

    function core_hsalsa20(o,p,k,c) {
      var j0  = c[ 0] & 0xff | (c[ 1] & 0xff)<<8 | (c[ 2] & 0xff)<<16 | (c[ 3] & 0xff)<<24,
          j1  = k[ 0] & 0xff | (k[ 1] & 0xff)<<8 | (k[ 2] & 0xff)<<16 | (k[ 3] & 0xff)<<24,
          j2  = k[ 4] & 0xff | (k[ 5] & 0xff)<<8 | (k[ 6] & 0xff)<<16 | (k[ 7] & 0xff)<<24,
          j3  = k[ 8] & 0xff | (k[ 9] & 0xff)<<8 | (k[10] & 0xff)<<16 | (k[11] & 0xff)<<24,
          j4  = k[12] & 0xff | (k[13] & 0xff)<<8 | (k[14] & 0xff)<<16 | (k[15] & 0xff)<<24,
          j5  = c[ 4] & 0xff | (c[ 5] & 0xff)<<8 | (c[ 6] & 0xff)<<16 | (c[ 7] & 0xff)<<24,
          j6  = p[ 0] & 0xff | (p[ 1] & 0xff)<<8 | (p[ 2] & 0xff)<<16 | (p[ 3] & 0xff)<<24,
          j7  = p[ 4] & 0xff | (p[ 5] & 0xff)<<8 | (p[ 6] & 0xff)<<16 | (p[ 7] & 0xff)<<24,
          j8  = p[ 8] & 0xff | (p[ 9] & 0xff)<<8 | (p[10] & 0xff)<<16 | (p[11] & 0xff)<<24,
          j9  = p[12] & 0xff | (p[13] & 0xff)<<8 | (p[14] & 0xff)<<16 | (p[15] & 0xff)<<24,
          j10 = c[ 8] & 0xff | (c[ 9] & 0xff)<<8 | (c[10] & 0xff)<<16 | (c[11] & 0xff)<<24,
          j11 = k[16] & 0xff | (k[17] & 0xff)<<8 | (k[18] & 0xff)<<16 | (k[19] & 0xff)<<24,
          j12 = k[20] & 0xff | (k[21] & 0xff)<<8 | (k[22] & 0xff)<<16 | (k[23] & 0xff)<<24,
          j13 = k[24] & 0xff | (k[25] & 0xff)<<8 | (k[26] & 0xff)<<16 | (k[27] & 0xff)<<24,
          j14 = k[28] & 0xff | (k[29] & 0xff)<<8 | (k[30] & 0xff)<<16 | (k[31] & 0xff)<<24,
          j15 = c[12] & 0xff | (c[13] & 0xff)<<8 | (c[14] & 0xff)<<16 | (c[15] & 0xff)<<24;

      var x0 = j0, x1 = j1, x2 = j2, x3 = j3, x4 = j4, x5 = j5, x6 = j6, x7 = j7,
          x8 = j8, x9 = j9, x10 = j10, x11 = j11, x12 = j12, x13 = j13, x14 = j14,
          x15 = j15, u;

      for (var i = 0; i < 20; i += 2) {
        u = x0 + x12 | 0;
        x4 ^= u<<7 | u>>>(32-7);
        u = x4 + x0 | 0;
        x8 ^= u<<9 | u>>>(32-9);
        u = x8 + x4 | 0;
        x12 ^= u<<13 | u>>>(32-13);
        u = x12 + x8 | 0;
        x0 ^= u<<18 | u>>>(32-18);

        u = x5 + x1 | 0;
        x9 ^= u<<7 | u>>>(32-7);
        u = x9 + x5 | 0;
        x13 ^= u<<9 | u>>>(32-9);
        u = x13 + x9 | 0;
        x1 ^= u<<13 | u>>>(32-13);
        u = x1 + x13 | 0;
        x5 ^= u<<18 | u>>>(32-18);

        u = x10 + x6 | 0;
        x14 ^= u<<7 | u>>>(32-7);
        u = x14 + x10 | 0;
        x2 ^= u<<9 | u>>>(32-9);
        u = x2 + x14 | 0;
        x6 ^= u<<13 | u>>>(32-13);
        u = x6 + x2 | 0;
        x10 ^= u<<18 | u>>>(32-18);

        u = x15 + x11 | 0;
        x3 ^= u<<7 | u>>>(32-7);
        u = x3 + x15 | 0;
        x7 ^= u<<9 | u>>>(32-9);
        u = x7 + x3 | 0;
        x11 ^= u<<13 | u>>>(32-13);
        u = x11 + x7 | 0;
        x15 ^= u<<18 | u>>>(32-18);

        u = x0 + x3 | 0;
        x1 ^= u<<7 | u>>>(32-7);
        u = x1 + x0 | 0;
        x2 ^= u<<9 | u>>>(32-9);
        u = x2 + x1 | 0;
        x3 ^= u<<13 | u>>>(32-13);
        u = x3 + x2 | 0;
        x0 ^= u<<18 | u>>>(32-18);

        u = x5 + x4 | 0;
        x6 ^= u<<7 | u>>>(32-7);
        u = x6 + x5 | 0;
        x7 ^= u<<9 | u>>>(32-9);
        u = x7 + x6 | 0;
        x4 ^= u<<13 | u>>>(32-13);
        u = x4 + x7 | 0;
        x5 ^= u<<18 | u>>>(32-18);

        u = x10 + x9 | 0;
        x11 ^= u<<7 | u>>>(32-7);
        u = x11 + x10 | 0;
        x8 ^= u<<9 | u>>>(32-9);
        u = x8 + x11 | 0;
        x9 ^= u<<13 | u>>>(32-13);
        u = x9 + x8 | 0;
        x10 ^= u<<18 | u>>>(32-18);

        u = x15 + x14 | 0;
        x12 ^= u<<7 | u>>>(32-7);
        u = x12 + x15 | 0;
        x13 ^= u<<9 | u>>>(32-9);
        u = x13 + x12 | 0;
        x14 ^= u<<13 | u>>>(32-13);
        u = x14 + x13 | 0;
        x15 ^= u<<18 | u>>>(32-18);
      }

      o[ 0] = x0 >>>  0 & 0xff;
      o[ 1] = x0 >>>  8 & 0xff;
      o[ 2] = x0 >>> 16 & 0xff;
      o[ 3] = x0 >>> 24 & 0xff;

      o[ 4] = x5 >>>  0 & 0xff;
      o[ 5] = x5 >>>  8 & 0xff;
      o[ 6] = x5 >>> 16 & 0xff;
      o[ 7] = x5 >>> 24 & 0xff;

      o[ 8] = x10 >>>  0 & 0xff;
      o[ 9] = x10 >>>  8 & 0xff;
      o[10] = x10 >>> 16 & 0xff;
      o[11] = x10 >>> 24 & 0xff;

      o[12] = x15 >>>  0 & 0xff;
      o[13] = x15 >>>  8 & 0xff;
      o[14] = x15 >>> 16 & 0xff;
      o[15] = x15 >>> 24 & 0xff;

      o[16] = x6 >>>  0 & 0xff;
      o[17] = x6 >>>  8 & 0xff;
      o[18] = x6 >>> 16 & 0xff;
      o[19] = x6 >>> 24 & 0xff;

      o[20] = x7 >>>  0 & 0xff;
      o[21] = x7 >>>  8 & 0xff;
      o[22] = x7 >>> 16 & 0xff;
      o[23] = x7 >>> 24 & 0xff;

      o[24] = x8 >>>  0 & 0xff;
      o[25] = x8 >>>  8 & 0xff;
      o[26] = x8 >>> 16 & 0xff;
      o[27] = x8 >>> 24 & 0xff;

      o[28] = x9 >>>  0 & 0xff;
      o[29] = x9 >>>  8 & 0xff;
      o[30] = x9 >>> 16 & 0xff;
      o[31] = x9 >>> 24 & 0xff;
    }

    function crypto_core_salsa20(out,inp,k,c) {
      core_salsa20(out,inp,k,c);
    }

    function crypto_core_hsalsa20(out,inp,k,c) {
      core_hsalsa20(out,inp,k,c);
    }

    var sigma = new Uint8Array([101, 120, 112, 97, 110, 100, 32, 51, 50, 45, 98, 121, 116, 101, 32, 107]);
                // "expand 32-byte k"

    function crypto_stream_salsa20_xor(c,cpos,m,mpos,b,n,k) {
      var z = new Uint8Array(16), x = new Uint8Array(64);
      var u, i;
      for (i = 0; i < 16; i++) z[i] = 0;
      for (i = 0; i < 8; i++) z[i] = n[i];
      while (b >= 64) {
        crypto_core_salsa20(x,z,k,sigma);
        for (i = 0; i < 64; i++) c[cpos+i] = m[mpos+i] ^ x[i];
        u = 1;
        for (i = 8; i < 16; i++) {
          u = u + (z[i] & 0xff) | 0;
          z[i] = u & 0xff;
          u >>>= 8;
        }
        b -= 64;
        cpos += 64;
        mpos += 64;
      }
      if (b > 0) {
        crypto_core_salsa20(x,z,k,sigma);
        for (i = 0; i < b; i++) c[cpos+i] = m[mpos+i] ^ x[i];
      }
      return 0;
    }

    function crypto_stream_salsa20(c,cpos,b,n,k) {
      var z = new Uint8Array(16), x = new Uint8Array(64);
      var u, i;
      for (i = 0; i < 16; i++) z[i] = 0;
      for (i = 0; i < 8; i++) z[i] = n[i];
      while (b >= 64) {
        crypto_core_salsa20(x,z,k,sigma);
        for (i = 0; i < 64; i++) c[cpos+i] = x[i];
        u = 1;
        for (i = 8; i < 16; i++) {
          u = u + (z[i] & 0xff) | 0;
          z[i] = u & 0xff;
          u >>>= 8;
        }
        b -= 64;
        cpos += 64;
      }
      if (b > 0) {
        crypto_core_salsa20(x,z,k,sigma);
        for (i = 0; i < b; i++) c[cpos+i] = x[i];
      }
      return 0;
    }

    function crypto_stream(c,cpos,d,n,k) {
      var s = new Uint8Array(32);
      crypto_core_hsalsa20(s,n,k,sigma);
      var sn = new Uint8Array(8);
      for (var i = 0; i < 8; i++) sn[i] = n[i+16];
      return crypto_stream_salsa20(c,cpos,d,sn,s);
    }

    function crypto_stream_xor(c,cpos,m,mpos,d,n,k) {
      var s = new Uint8Array(32);
      crypto_core_hsalsa20(s,n,k,sigma);
      var sn = new Uint8Array(8);
      for (var i = 0; i < 8; i++) sn[i] = n[i+16];
      return crypto_stream_salsa20_xor(c,cpos,m,mpos,d,sn,s);
    }

    /*
    * Port of Andrew Moon's Poly1305-donna-16. Public domain.
    * https://github.com/floodyberry/poly1305-donna
    */

    var poly1305 = function(key) {
      this.buffer = new Uint8Array(16);
      this.r = new Uint16Array(10);
      this.h = new Uint16Array(10);
      this.pad = new Uint16Array(8);
      this.leftover = 0;
      this.fin = 0;

      var t0, t1, t2, t3, t4, t5, t6, t7;

      t0 = key[ 0] & 0xff | (key[ 1] & 0xff) << 8; this.r[0] = ( t0                     ) & 0x1fff;
      t1 = key[ 2] & 0xff | (key[ 3] & 0xff) << 8; this.r[1] = ((t0 >>> 13) | (t1 <<  3)) & 0x1fff;
      t2 = key[ 4] & 0xff | (key[ 5] & 0xff) << 8; this.r[2] = ((t1 >>> 10) | (t2 <<  6)) & 0x1f03;
      t3 = key[ 6] & 0xff | (key[ 7] & 0xff) << 8; this.r[3] = ((t2 >>>  7) | (t3 <<  9)) & 0x1fff;
      t4 = key[ 8] & 0xff | (key[ 9] & 0xff) << 8; this.r[4] = ((t3 >>>  4) | (t4 << 12)) & 0x00ff;
      this.r[5] = ((t4 >>>  1)) & 0x1ffe;
      t5 = key[10] & 0xff | (key[11] & 0xff) << 8; this.r[6] = ((t4 >>> 14) | (t5 <<  2)) & 0x1fff;
      t6 = key[12] & 0xff | (key[13] & 0xff) << 8; this.r[7] = ((t5 >>> 11) | (t6 <<  5)) & 0x1f81;
      t7 = key[14] & 0xff | (key[15] & 0xff) << 8; this.r[8] = ((t6 >>>  8) | (t7 <<  8)) & 0x1fff;
      this.r[9] = ((t7 >>>  5)) & 0x007f;

      this.pad[0] = key[16] & 0xff | (key[17] & 0xff) << 8;
      this.pad[1] = key[18] & 0xff | (key[19] & 0xff) << 8;
      this.pad[2] = key[20] & 0xff | (key[21] & 0xff) << 8;
      this.pad[3] = key[22] & 0xff | (key[23] & 0xff) << 8;
      this.pad[4] = key[24] & 0xff | (key[25] & 0xff) << 8;
      this.pad[5] = key[26] & 0xff | (key[27] & 0xff) << 8;
      this.pad[6] = key[28] & 0xff | (key[29] & 0xff) << 8;
      this.pad[7] = key[30] & 0xff | (key[31] & 0xff) << 8;
    };

    poly1305.prototype.blocks = function(m, mpos, bytes) {
      var hibit = this.fin ? 0 : (1 << 11);
      var t0, t1, t2, t3, t4, t5, t6, t7, c;
      var d0, d1, d2, d3, d4, d5, d6, d7, d8, d9;

      var h0 = this.h[0],
          h1 = this.h[1],
          h2 = this.h[2],
          h3 = this.h[3],
          h4 = this.h[4],
          h5 = this.h[5],
          h6 = this.h[6],
          h7 = this.h[7],
          h8 = this.h[8],
          h9 = this.h[9];

      var r0 = this.r[0],
          r1 = this.r[1],
          r2 = this.r[2],
          r3 = this.r[3],
          r4 = this.r[4],
          r5 = this.r[5],
          r6 = this.r[6],
          r7 = this.r[7],
          r8 = this.r[8],
          r9 = this.r[9];

      while (bytes >= 16) {
        t0 = m[mpos+ 0] & 0xff | (m[mpos+ 1] & 0xff) << 8; h0 += ( t0                     ) & 0x1fff;
        t1 = m[mpos+ 2] & 0xff | (m[mpos+ 3] & 0xff) << 8; h1 += ((t0 >>> 13) | (t1 <<  3)) & 0x1fff;
        t2 = m[mpos+ 4] & 0xff | (m[mpos+ 5] & 0xff) << 8; h2 += ((t1 >>> 10) | (t2 <<  6)) & 0x1fff;
        t3 = m[mpos+ 6] & 0xff | (m[mpos+ 7] & 0xff) << 8; h3 += ((t2 >>>  7) | (t3 <<  9)) & 0x1fff;
        t4 = m[mpos+ 8] & 0xff | (m[mpos+ 9] & 0xff) << 8; h4 += ((t3 >>>  4) | (t4 << 12)) & 0x1fff;
        h5 += ((t4 >>>  1)) & 0x1fff;
        t5 = m[mpos+10] & 0xff | (m[mpos+11] & 0xff) << 8; h6 += ((t4 >>> 14) | (t5 <<  2)) & 0x1fff;
        t6 = m[mpos+12] & 0xff | (m[mpos+13] & 0xff) << 8; h7 += ((t5 >>> 11) | (t6 <<  5)) & 0x1fff;
        t7 = m[mpos+14] & 0xff | (m[mpos+15] & 0xff) << 8; h8 += ((t6 >>>  8) | (t7 <<  8)) & 0x1fff;
        h9 += ((t7 >>> 5)) | hibit;

        c = 0;

        d0 = c;
        d0 += h0 * r0;
        d0 += h1 * (5 * r9);
        d0 += h2 * (5 * r8);
        d0 += h3 * (5 * r7);
        d0 += h4 * (5 * r6);
        c = (d0 >>> 13); d0 &= 0x1fff;
        d0 += h5 * (5 * r5);
        d0 += h6 * (5 * r4);
        d0 += h7 * (5 * r3);
        d0 += h8 * (5 * r2);
        d0 += h9 * (5 * r1);
        c += (d0 >>> 13); d0 &= 0x1fff;

        d1 = c;
        d1 += h0 * r1;
        d1 += h1 * r0;
        d1 += h2 * (5 * r9);
        d1 += h3 * (5 * r8);
        d1 += h4 * (5 * r7);
        c = (d1 >>> 13); d1 &= 0x1fff;
        d1 += h5 * (5 * r6);
        d1 += h6 * (5 * r5);
        d1 += h7 * (5 * r4);
        d1 += h8 * (5 * r3);
        d1 += h9 * (5 * r2);
        c += (d1 >>> 13); d1 &= 0x1fff;

        d2 = c;
        d2 += h0 * r2;
        d2 += h1 * r1;
        d2 += h2 * r0;
        d2 += h3 * (5 * r9);
        d2 += h4 * (5 * r8);
        c = (d2 >>> 13); d2 &= 0x1fff;
        d2 += h5 * (5 * r7);
        d2 += h6 * (5 * r6);
        d2 += h7 * (5 * r5);
        d2 += h8 * (5 * r4);
        d2 += h9 * (5 * r3);
        c += (d2 >>> 13); d2 &= 0x1fff;

        d3 = c;
        d3 += h0 * r3;
        d3 += h1 * r2;
        d3 += h2 * r1;
        d3 += h3 * r0;
        d3 += h4 * (5 * r9);
        c = (d3 >>> 13); d3 &= 0x1fff;
        d3 += h5 * (5 * r8);
        d3 += h6 * (5 * r7);
        d3 += h7 * (5 * r6);
        d3 += h8 * (5 * r5);
        d3 += h9 * (5 * r4);
        c += (d3 >>> 13); d3 &= 0x1fff;

        d4 = c;
        d4 += h0 * r4;
        d4 += h1 * r3;
        d4 += h2 * r2;
        d4 += h3 * r1;
        d4 += h4 * r0;
        c = (d4 >>> 13); d4 &= 0x1fff;
        d4 += h5 * (5 * r9);
        d4 += h6 * (5 * r8);
        d4 += h7 * (5 * r7);
        d4 += h8 * (5 * r6);
        d4 += h9 * (5 * r5);
        c += (d4 >>> 13); d4 &= 0x1fff;

        d5 = c;
        d5 += h0 * r5;
        d5 += h1 * r4;
        d5 += h2 * r3;
        d5 += h3 * r2;
        d5 += h4 * r1;
        c = (d5 >>> 13); d5 &= 0x1fff;
        d5 += h5 * r0;
        d5 += h6 * (5 * r9);
        d5 += h7 * (5 * r8);
        d5 += h8 * (5 * r7);
        d5 += h9 * (5 * r6);
        c += (d5 >>> 13); d5 &= 0x1fff;

        d6 = c;
        d6 += h0 * r6;
        d6 += h1 * r5;
        d6 += h2 * r4;
        d6 += h3 * r3;
        d6 += h4 * r2;
        c = (d6 >>> 13); d6 &= 0x1fff;
        d6 += h5 * r1;
        d6 += h6 * r0;
        d6 += h7 * (5 * r9);
        d6 += h8 * (5 * r8);
        d6 += h9 * (5 * r7);
        c += (d6 >>> 13); d6 &= 0x1fff;

        d7 = c;
        d7 += h0 * r7;
        d7 += h1 * r6;
        d7 += h2 * r5;
        d7 += h3 * r4;
        d7 += h4 * r3;
        c = (d7 >>> 13); d7 &= 0x1fff;
        d7 += h5 * r2;
        d7 += h6 * r1;
        d7 += h7 * r0;
        d7 += h8 * (5 * r9);
        d7 += h9 * (5 * r8);
        c += (d7 >>> 13); d7 &= 0x1fff;

        d8 = c;
        d8 += h0 * r8;
        d8 += h1 * r7;
        d8 += h2 * r6;
        d8 += h3 * r5;
        d8 += h4 * r4;
        c = (d8 >>> 13); d8 &= 0x1fff;
        d8 += h5 * r3;
        d8 += h6 * r2;
        d8 += h7 * r1;
        d8 += h8 * r0;
        d8 += h9 * (5 * r9);
        c += (d8 >>> 13); d8 &= 0x1fff;

        d9 = c;
        d9 += h0 * r9;
        d9 += h1 * r8;
        d9 += h2 * r7;
        d9 += h3 * r6;
        d9 += h4 * r5;
        c = (d9 >>> 13); d9 &= 0x1fff;
        d9 += h5 * r4;
        d9 += h6 * r3;
        d9 += h7 * r2;
        d9 += h8 * r1;
        d9 += h9 * r0;
        c += (d9 >>> 13); d9 &= 0x1fff;

        c = (((c << 2) + c)) | 0;
        c = (c + d0) | 0;
        d0 = c & 0x1fff;
        c = (c >>> 13);
        d1 += c;

        h0 = d0;
        h1 = d1;
        h2 = d2;
        h3 = d3;
        h4 = d4;
        h5 = d5;
        h6 = d6;
        h7 = d7;
        h8 = d8;
        h9 = d9;

        mpos += 16;
        bytes -= 16;
      }
      this.h[0] = h0;
      this.h[1] = h1;
      this.h[2] = h2;
      this.h[3] = h3;
      this.h[4] = h4;
      this.h[5] = h5;
      this.h[6] = h6;
      this.h[7] = h7;
      this.h[8] = h8;
      this.h[9] = h9;
    };

    poly1305.prototype.finish = function(mac, macpos) {
      var g = new Uint16Array(10);
      var c, mask, f, i;

      if (this.leftover) {
        i = this.leftover;
        this.buffer[i++] = 1;
        for (; i < 16; i++) this.buffer[i] = 0;
        this.fin = 1;
        this.blocks(this.buffer, 0, 16);
      }

      c = this.h[1] >>> 13;
      this.h[1] &= 0x1fff;
      for (i = 2; i < 10; i++) {
        this.h[i] += c;
        c = this.h[i] >>> 13;
        this.h[i] &= 0x1fff;
      }
      this.h[0] += (c * 5);
      c = this.h[0] >>> 13;
      this.h[0] &= 0x1fff;
      this.h[1] += c;
      c = this.h[1] >>> 13;
      this.h[1] &= 0x1fff;
      this.h[2] += c;

      g[0] = this.h[0] + 5;
      c = g[0] >>> 13;
      g[0] &= 0x1fff;
      for (i = 1; i < 10; i++) {
        g[i] = this.h[i] + c;
        c = g[i] >>> 13;
        g[i] &= 0x1fff;
      }
      g[9] -= (1 << 13);

      mask = (c ^ 1) - 1;
      for (i = 0; i < 10; i++) g[i] &= mask;
      mask = ~mask;
      for (i = 0; i < 10; i++) this.h[i] = (this.h[i] & mask) | g[i];

      this.h[0] = ((this.h[0]       ) | (this.h[1] << 13)                    ) & 0xffff;
      this.h[1] = ((this.h[1] >>>  3) | (this.h[2] << 10)                    ) & 0xffff;
      this.h[2] = ((this.h[2] >>>  6) | (this.h[3] <<  7)                    ) & 0xffff;
      this.h[3] = ((this.h[3] >>>  9) | (this.h[4] <<  4)                    ) & 0xffff;
      this.h[4] = ((this.h[4] >>> 12) | (this.h[5] <<  1) | (this.h[6] << 14)) & 0xffff;
      this.h[5] = ((this.h[6] >>>  2) | (this.h[7] << 11)                    ) & 0xffff;
      this.h[6] = ((this.h[7] >>>  5) | (this.h[8] <<  8)                    ) & 0xffff;
      this.h[7] = ((this.h[8] >>>  8) | (this.h[9] <<  5)                    ) & 0xffff;

      f = this.h[0] + this.pad[0];
      this.h[0] = f & 0xffff;
      for (i = 1; i < 8; i++) {
        f = (((this.h[i] + this.pad[i]) | 0) + (f >>> 16)) | 0;
        this.h[i] = f & 0xffff;
      }

      mac[macpos+ 0] = (this.h[0] >>> 0) & 0xff;
      mac[macpos+ 1] = (this.h[0] >>> 8) & 0xff;
      mac[macpos+ 2] = (this.h[1] >>> 0) & 0xff;
      mac[macpos+ 3] = (this.h[1] >>> 8) & 0xff;
      mac[macpos+ 4] = (this.h[2] >>> 0) & 0xff;
      mac[macpos+ 5] = (this.h[2] >>> 8) & 0xff;
      mac[macpos+ 6] = (this.h[3] >>> 0) & 0xff;
      mac[macpos+ 7] = (this.h[3] >>> 8) & 0xff;
      mac[macpos+ 8] = (this.h[4] >>> 0) & 0xff;
      mac[macpos+ 9] = (this.h[4] >>> 8) & 0xff;
      mac[macpos+10] = (this.h[5] >>> 0) & 0xff;
      mac[macpos+11] = (this.h[5] >>> 8) & 0xff;
      mac[macpos+12] = (this.h[6] >>> 0) & 0xff;
      mac[macpos+13] = (this.h[6] >>> 8) & 0xff;
      mac[macpos+14] = (this.h[7] >>> 0) & 0xff;
      mac[macpos+15] = (this.h[7] >>> 8) & 0xff;
    };

    poly1305.prototype.update = function(m, mpos, bytes) {
      var i, want;

      if (this.leftover) {
        want = (16 - this.leftover);
        if (want > bytes)
          want = bytes;
        for (i = 0; i < want; i++)
          this.buffer[this.leftover + i] = m[mpos+i];
        bytes -= want;
        mpos += want;
        this.leftover += want;
        if (this.leftover < 16)
          return;
        this.blocks(this.buffer, 0, 16);
        this.leftover = 0;
      }

      if (bytes >= 16) {
        want = bytes - (bytes % 16);
        this.blocks(m, mpos, want);
        mpos += want;
        bytes -= want;
      }

      if (bytes) {
        for (i = 0; i < bytes; i++)
          this.buffer[this.leftover + i] = m[mpos+i];
        this.leftover += bytes;
      }
    };

    function crypto_onetimeauth(out, outpos, m, mpos, n, k) {
      var s = new poly1305(k);
      s.update(m, mpos, n);
      s.finish(out, outpos);
      return 0;
    }

    function crypto_onetimeauth_verify(h, hpos, m, mpos, n, k) {
      var x = new Uint8Array(16);
      crypto_onetimeauth(x,0,m,mpos,n,k);
      return crypto_verify_16(h,hpos,x,0);
    }

    function crypto_secretbox(c,m,d,n,k) {
      var i;
      if (d < 32) return -1;
      crypto_stream_xor(c,0,m,0,d,n,k);
      crypto_onetimeauth(c, 16, c, 32, d - 32, c);
      for (i = 0; i < 16; i++) c[i] = 0;
      return 0;
    }

    function crypto_secretbox_open(m,c,d,n,k) {
      var i;
      var x = new Uint8Array(32);
      if (d < 32) return -1;
      crypto_stream(x,0,32,n,k);
      if (crypto_onetimeauth_verify(c, 16,c, 32,d - 32,x) !== 0) return -1;
      crypto_stream_xor(m,0,c,0,d,n,k);
      for (i = 0; i < 32; i++) m[i] = 0;
      return 0;
    }

    function set25519(r, a) {
      var i;
      for (i = 0; i < 16; i++) r[i] = a[i]|0;
    }

    function car25519(o) {
      var i, v, c = 1;
      for (i = 0; i < 16; i++) {
        v = o[i] + c + 65535;
        c = Math.floor(v / 65536);
        o[i] = v - c * 65536;
      }
      o[0] += c-1 + 37 * (c-1);
    }

    function sel25519(p, q, b) {
      var t, c = ~(b-1);
      for (var i = 0; i < 16; i++) {
        t = c & (p[i] ^ q[i]);
        p[i] ^= t;
        q[i] ^= t;
      }
    }

    function pack25519(o, n) {
      var i, j, b;
      var m = gf(), t = gf();
      for (i = 0; i < 16; i++) t[i] = n[i];
      car25519(t);
      car25519(t);
      car25519(t);
      for (j = 0; j < 2; j++) {
        m[0] = t[0] - 0xffed;
        for (i = 1; i < 15; i++) {
          m[i] = t[i] - 0xffff - ((m[i-1]>>16) & 1);
          m[i-1] &= 0xffff;
        }
        m[15] = t[15] - 0x7fff - ((m[14]>>16) & 1);
        b = (m[15]>>16) & 1;
        m[14] &= 0xffff;
        sel25519(t, m, 1-b);
      }
      for (i = 0; i < 16; i++) {
        o[2*i] = t[i] & 0xff;
        o[2*i+1] = t[i]>>8;
      }
    }

    function neq25519(a, b) {
      var c = new Uint8Array(32), d = new Uint8Array(32);
      pack25519(c, a);
      pack25519(d, b);
      return crypto_verify_32(c, 0, d, 0);
    }

    function par25519(a) {
      var d = new Uint8Array(32);
      pack25519(d, a);
      return d[0] & 1;
    }

    function unpack25519(o, n) {
      var i;
      for (i = 0; i < 16; i++) o[i] = n[2*i] + (n[2*i+1] << 8);
      o[15] &= 0x7fff;
    }

    function A(o, a, b) {
      for (var i = 0; i < 16; i++) o[i] = a[i] + b[i];
    }

    function Z(o, a, b) {
      for (var i = 0; i < 16; i++) o[i] = a[i] - b[i];
    }

    function M(o, a, b) {
      var v, c,
         t0 = 0,  t1 = 0,  t2 = 0,  t3 = 0,  t4 = 0,  t5 = 0,  t6 = 0,  t7 = 0,
         t8 = 0,  t9 = 0, t10 = 0, t11 = 0, t12 = 0, t13 = 0, t14 = 0, t15 = 0,
        t16 = 0, t17 = 0, t18 = 0, t19 = 0, t20 = 0, t21 = 0, t22 = 0, t23 = 0,
        t24 = 0, t25 = 0, t26 = 0, t27 = 0, t28 = 0, t29 = 0, t30 = 0,
        b0 = b[0],
        b1 = b[1],
        b2 = b[2],
        b3 = b[3],
        b4 = b[4],
        b5 = b[5],
        b6 = b[6],
        b7 = b[7],
        b8 = b[8],
        b9 = b[9],
        b10 = b[10],
        b11 = b[11],
        b12 = b[12],
        b13 = b[13],
        b14 = b[14],
        b15 = b[15];

      v = a[0];
      t0 += v * b0;
      t1 += v * b1;
      t2 += v * b2;
      t3 += v * b3;
      t4 += v * b4;
      t5 += v * b5;
      t6 += v * b6;
      t7 += v * b7;
      t8 += v * b8;
      t9 += v * b9;
      t10 += v * b10;
      t11 += v * b11;
      t12 += v * b12;
      t13 += v * b13;
      t14 += v * b14;
      t15 += v * b15;
      v = a[1];
      t1 += v * b0;
      t2 += v * b1;
      t3 += v * b2;
      t4 += v * b3;
      t5 += v * b4;
      t6 += v * b5;
      t7 += v * b6;
      t8 += v * b7;
      t9 += v * b8;
      t10 += v * b9;
      t11 += v * b10;
      t12 += v * b11;
      t13 += v * b12;
      t14 += v * b13;
      t15 += v * b14;
      t16 += v * b15;
      v = a[2];
      t2 += v * b0;
      t3 += v * b1;
      t4 += v * b2;
      t5 += v * b3;
      t6 += v * b4;
      t7 += v * b5;
      t8 += v * b6;
      t9 += v * b7;
      t10 += v * b8;
      t11 += v * b9;
      t12 += v * b10;
      t13 += v * b11;
      t14 += v * b12;
      t15 += v * b13;
      t16 += v * b14;
      t17 += v * b15;
      v = a[3];
      t3 += v * b0;
      t4 += v * b1;
      t5 += v * b2;
      t6 += v * b3;
      t7 += v * b4;
      t8 += v * b5;
      t9 += v * b6;
      t10 += v * b7;
      t11 += v * b8;
      t12 += v * b9;
      t13 += v * b10;
      t14 += v * b11;
      t15 += v * b12;
      t16 += v * b13;
      t17 += v * b14;
      t18 += v * b15;
      v = a[4];
      t4 += v * b0;
      t5 += v * b1;
      t6 += v * b2;
      t7 += v * b3;
      t8 += v * b4;
      t9 += v * b5;
      t10 += v * b6;
      t11 += v * b7;
      t12 += v * b8;
      t13 += v * b9;
      t14 += v * b10;
      t15 += v * b11;
      t16 += v * b12;
      t17 += v * b13;
      t18 += v * b14;
      t19 += v * b15;
      v = a[5];
      t5 += v * b0;
      t6 += v * b1;
      t7 += v * b2;
      t8 += v * b3;
      t9 += v * b4;
      t10 += v * b5;
      t11 += v * b6;
      t12 += v * b7;
      t13 += v * b8;
      t14 += v * b9;
      t15 += v * b10;
      t16 += v * b11;
      t17 += v * b12;
      t18 += v * b13;
      t19 += v * b14;
      t20 += v * b15;
      v = a[6];
      t6 += v * b0;
      t7 += v * b1;
      t8 += v * b2;
      t9 += v * b3;
      t10 += v * b4;
      t11 += v * b5;
      t12 += v * b6;
      t13 += v * b7;
      t14 += v * b8;
      t15 += v * b9;
      t16 += v * b10;
      t17 += v * b11;
      t18 += v * b12;
      t19 += v * b13;
      t20 += v * b14;
      t21 += v * b15;
      v = a[7];
      t7 += v * b0;
      t8 += v * b1;
      t9 += v * b2;
      t10 += v * b3;
      t11 += v * b4;
      t12 += v * b5;
      t13 += v * b6;
      t14 += v * b7;
      t15 += v * b8;
      t16 += v * b9;
      t17 += v * b10;
      t18 += v * b11;
      t19 += v * b12;
      t20 += v * b13;
      t21 += v * b14;
      t22 += v * b15;
      v = a[8];
      t8 += v * b0;
      t9 += v * b1;
      t10 += v * b2;
      t11 += v * b3;
      t12 += v * b4;
      t13 += v * b5;
      t14 += v * b6;
      t15 += v * b7;
      t16 += v * b8;
      t17 += v * b9;
      t18 += v * b10;
      t19 += v * b11;
      t20 += v * b12;
      t21 += v * b13;
      t22 += v * b14;
      t23 += v * b15;
      v = a[9];
      t9 += v * b0;
      t10 += v * b1;
      t11 += v * b2;
      t12 += v * b3;
      t13 += v * b4;
      t14 += v * b5;
      t15 += v * b6;
      t16 += v * b7;
      t17 += v * b8;
      t18 += v * b9;
      t19 += v * b10;
      t20 += v * b11;
      t21 += v * b12;
      t22 += v * b13;
      t23 += v * b14;
      t24 += v * b15;
      v = a[10];
      t10 += v * b0;
      t11 += v * b1;
      t12 += v * b2;
      t13 += v * b3;
      t14 += v * b4;
      t15 += v * b5;
      t16 += v * b6;
      t17 += v * b7;
      t18 += v * b8;
      t19 += v * b9;
      t20 += v * b10;
      t21 += v * b11;
      t22 += v * b12;
      t23 += v * b13;
      t24 += v * b14;
      t25 += v * b15;
      v = a[11];
      t11 += v * b0;
      t12 += v * b1;
      t13 += v * b2;
      t14 += v * b3;
      t15 += v * b4;
      t16 += v * b5;
      t17 += v * b6;
      t18 += v * b7;
      t19 += v * b8;
      t20 += v * b9;
      t21 += v * b10;
      t22 += v * b11;
      t23 += v * b12;
      t24 += v * b13;
      t25 += v * b14;
      t26 += v * b15;
      v = a[12];
      t12 += v * b0;
      t13 += v * b1;
      t14 += v * b2;
      t15 += v * b3;
      t16 += v * b4;
      t17 += v * b5;
      t18 += v * b6;
      t19 += v * b7;
      t20 += v * b8;
      t21 += v * b9;
      t22 += v * b10;
      t23 += v * b11;
      t24 += v * b12;
      t25 += v * b13;
      t26 += v * b14;
      t27 += v * b15;
      v = a[13];
      t13 += v * b0;
      t14 += v * b1;
      t15 += v * b2;
      t16 += v * b3;
      t17 += v * b4;
      t18 += v * b5;
      t19 += v * b6;
      t20 += v * b7;
      t21 += v * b8;
      t22 += v * b9;
      t23 += v * b10;
      t24 += v * b11;
      t25 += v * b12;
      t26 += v * b13;
      t27 += v * b14;
      t28 += v * b15;
      v = a[14];
      t14 += v * b0;
      t15 += v * b1;
      t16 += v * b2;
      t17 += v * b3;
      t18 += v * b4;
      t19 += v * b5;
      t20 += v * b6;
      t21 += v * b7;
      t22 += v * b8;
      t23 += v * b9;
      t24 += v * b10;
      t25 += v * b11;
      t26 += v * b12;
      t27 += v * b13;
      t28 += v * b14;
      t29 += v * b15;
      v = a[15];
      t15 += v * b0;
      t16 += v * b1;
      t17 += v * b2;
      t18 += v * b3;
      t19 += v * b4;
      t20 += v * b5;
      t21 += v * b6;
      t22 += v * b7;
      t23 += v * b8;
      t24 += v * b9;
      t25 += v * b10;
      t26 += v * b11;
      t27 += v * b12;
      t28 += v * b13;
      t29 += v * b14;
      t30 += v * b15;

      t0  += 38 * t16;
      t1  += 38 * t17;
      t2  += 38 * t18;
      t3  += 38 * t19;
      t4  += 38 * t20;
      t5  += 38 * t21;
      t6  += 38 * t22;
      t7  += 38 * t23;
      t8  += 38 * t24;
      t9  += 38 * t25;
      t10 += 38 * t26;
      t11 += 38 * t27;
      t12 += 38 * t28;
      t13 += 38 * t29;
      t14 += 38 * t30;
      // t15 left as is

      // first car
      c = 1;
      v =  t0 + c + 65535; c = Math.floor(v / 65536);  t0 = v - c * 65536;
      v =  t1 + c + 65535; c = Math.floor(v / 65536);  t1 = v - c * 65536;
      v =  t2 + c + 65535; c = Math.floor(v / 65536);  t2 = v - c * 65536;
      v =  t3 + c + 65535; c = Math.floor(v / 65536);  t3 = v - c * 65536;
      v =  t4 + c + 65535; c = Math.floor(v / 65536);  t4 = v - c * 65536;
      v =  t5 + c + 65535; c = Math.floor(v / 65536);  t5 = v - c * 65536;
      v =  t6 + c + 65535; c = Math.floor(v / 65536);  t6 = v - c * 65536;
      v =  t7 + c + 65535; c = Math.floor(v / 65536);  t7 = v - c * 65536;
      v =  t8 + c + 65535; c = Math.floor(v / 65536);  t8 = v - c * 65536;
      v =  t9 + c + 65535; c = Math.floor(v / 65536);  t9 = v - c * 65536;
      v = t10 + c + 65535; c = Math.floor(v / 65536); t10 = v - c * 65536;
      v = t11 + c + 65535; c = Math.floor(v / 65536); t11 = v - c * 65536;
      v = t12 + c + 65535; c = Math.floor(v / 65536); t12 = v - c * 65536;
      v = t13 + c + 65535; c = Math.floor(v / 65536); t13 = v - c * 65536;
      v = t14 + c + 65535; c = Math.floor(v / 65536); t14 = v - c * 65536;
      v = t15 + c + 65535; c = Math.floor(v / 65536); t15 = v - c * 65536;
      t0 += c-1 + 37 * (c-1);

      // second car
      c = 1;
      v =  t0 + c + 65535; c = Math.floor(v / 65536);  t0 = v - c * 65536;
      v =  t1 + c + 65535; c = Math.floor(v / 65536);  t1 = v - c * 65536;
      v =  t2 + c + 65535; c = Math.floor(v / 65536);  t2 = v - c * 65536;
      v =  t3 + c + 65535; c = Math.floor(v / 65536);  t3 = v - c * 65536;
      v =  t4 + c + 65535; c = Math.floor(v / 65536);  t4 = v - c * 65536;
      v =  t5 + c + 65535; c = Math.floor(v / 65536);  t5 = v - c * 65536;
      v =  t6 + c + 65535; c = Math.floor(v / 65536);  t6 = v - c * 65536;
      v =  t7 + c + 65535; c = Math.floor(v / 65536);  t7 = v - c * 65536;
      v =  t8 + c + 65535; c = Math.floor(v / 65536);  t8 = v - c * 65536;
      v =  t9 + c + 65535; c = Math.floor(v / 65536);  t9 = v - c * 65536;
      v = t10 + c + 65535; c = Math.floor(v / 65536); t10 = v - c * 65536;
      v = t11 + c + 65535; c = Math.floor(v / 65536); t11 = v - c * 65536;
      v = t12 + c + 65535; c = Math.floor(v / 65536); t12 = v - c * 65536;
      v = t13 + c + 65535; c = Math.floor(v / 65536); t13 = v - c * 65536;
      v = t14 + c + 65535; c = Math.floor(v / 65536); t14 = v - c * 65536;
      v = t15 + c + 65535; c = Math.floor(v / 65536); t15 = v - c * 65536;
      t0 += c-1 + 37 * (c-1);

      o[ 0] = t0;
      o[ 1] = t1;
      o[ 2] = t2;
      o[ 3] = t3;
      o[ 4] = t4;
      o[ 5] = t5;
      o[ 6] = t6;
      o[ 7] = t7;
      o[ 8] = t8;
      o[ 9] = t9;
      o[10] = t10;
      o[11] = t11;
      o[12] = t12;
      o[13] = t13;
      o[14] = t14;
      o[15] = t15;
    }

    function S(o, a) {
      M(o, a, a);
    }

    function inv25519(o, i) {
      var c = gf();
      var a;
      for (a = 0; a < 16; a++) c[a] = i[a];
      for (a = 253; a >= 0; a--) {
        S(c, c);
        if(a !== 2 && a !== 4) M(c, c, i);
      }
      for (a = 0; a < 16; a++) o[a] = c[a];
    }

    function pow2523(o, i) {
      var c = gf();
      var a;
      for (a = 0; a < 16; a++) c[a] = i[a];
      for (a = 250; a >= 0; a--) {
          S(c, c);
          if(a !== 1) M(c, c, i);
      }
      for (a = 0; a < 16; a++) o[a] = c[a];
    }

    function crypto_scalarmult(q, n, p) {
      var z = new Uint8Array(32);
      var x = new Float64Array(80), r, i;
      var a = gf(), b = gf(), c = gf(),
          d = gf(), e = gf(), f = gf();
      for (i = 0; i < 31; i++) z[i] = n[i];
      z[31]=(n[31]&127)|64;
      z[0]&=248;
      unpack25519(x,p);
      for (i = 0; i < 16; i++) {
        b[i]=x[i];
        d[i]=a[i]=c[i]=0;
      }
      a[0]=d[0]=1;
      for (i=254; i>=0; --i) {
        r=(z[i>>>3]>>>(i&7))&1;
        sel25519(a,b,r);
        sel25519(c,d,r);
        A(e,a,c);
        Z(a,a,c);
        A(c,b,d);
        Z(b,b,d);
        S(d,e);
        S(f,a);
        M(a,c,a);
        M(c,b,e);
        A(e,a,c);
        Z(a,a,c);
        S(b,a);
        Z(c,d,f);
        M(a,c,_121665);
        A(a,a,d);
        M(c,c,a);
        M(a,d,f);
        M(d,b,x);
        S(b,e);
        sel25519(a,b,r);
        sel25519(c,d,r);
      }
      for (i = 0; i < 16; i++) {
        x[i+16]=a[i];
        x[i+32]=c[i];
        x[i+48]=b[i];
        x[i+64]=d[i];
      }
      var x32 = x.subarray(32);
      var x16 = x.subarray(16);
      inv25519(x32,x32);
      M(x16,x16,x32);
      pack25519(q,x16);
      return 0;
    }

    function crypto_scalarmult_base(q, n) {
      return crypto_scalarmult(q, n, _9);
    }

    function crypto_box_keypair(y, x) {
      randombytes(x, 32);
      return crypto_scalarmult_base(y, x);
    }

    function crypto_box_beforenm(k, y, x) {
      var s = new Uint8Array(32);
      crypto_scalarmult(s, x, y);
      return crypto_core_hsalsa20(k, _0, s, sigma);
    }

    var crypto_box_afternm = crypto_secretbox;
    var crypto_box_open_afternm = crypto_secretbox_open;

    function crypto_box(c, m, d, n, y, x) {
      var k = new Uint8Array(32);
      crypto_box_beforenm(k, y, x);
      return crypto_box_afternm(c, m, d, n, k);
    }

    function crypto_box_open(m, c, d, n, y, x) {
      var k = new Uint8Array(32);
      crypto_box_beforenm(k, y, x);
      return crypto_box_open_afternm(m, c, d, n, k);
    }

    var K = [
      0x428a2f98, 0xd728ae22, 0x71374491, 0x23ef65cd,
      0xb5c0fbcf, 0xec4d3b2f, 0xe9b5dba5, 0x8189dbbc,
      0x3956c25b, 0xf348b538, 0x59f111f1, 0xb605d019,
      0x923f82a4, 0xaf194f9b, 0xab1c5ed5, 0xda6d8118,
      0xd807aa98, 0xa3030242, 0x12835b01, 0x45706fbe,
      0x243185be, 0x4ee4b28c, 0x550c7dc3, 0xd5ffb4e2,
      0x72be5d74, 0xf27b896f, 0x80deb1fe, 0x3b1696b1,
      0x9bdc06a7, 0x25c71235, 0xc19bf174, 0xcf692694,
      0xe49b69c1, 0x9ef14ad2, 0xefbe4786, 0x384f25e3,
      0x0fc19dc6, 0x8b8cd5b5, 0x240ca1cc, 0x77ac9c65,
      0x2de92c6f, 0x592b0275, 0x4a7484aa, 0x6ea6e483,
      0x5cb0a9dc, 0xbd41fbd4, 0x76f988da, 0x831153b5,
      0x983e5152, 0xee66dfab, 0xa831c66d, 0x2db43210,
      0xb00327c8, 0x98fb213f, 0xbf597fc7, 0xbeef0ee4,
      0xc6e00bf3, 0x3da88fc2, 0xd5a79147, 0x930aa725,
      0x06ca6351, 0xe003826f, 0x14292967, 0x0a0e6e70,
      0x27b70a85, 0x46d22ffc, 0x2e1b2138, 0x5c26c926,
      0x4d2c6dfc, 0x5ac42aed, 0x53380d13, 0x9d95b3df,
      0x650a7354, 0x8baf63de, 0x766a0abb, 0x3c77b2a8,
      0x81c2c92e, 0x47edaee6, 0x92722c85, 0x1482353b,
      0xa2bfe8a1, 0x4cf10364, 0xa81a664b, 0xbc423001,
      0xc24b8b70, 0xd0f89791, 0xc76c51a3, 0x0654be30,
      0xd192e819, 0xd6ef5218, 0xd6990624, 0x5565a910,
      0xf40e3585, 0x5771202a, 0x106aa070, 0x32bbd1b8,
      0x19a4c116, 0xb8d2d0c8, 0x1e376c08, 0x5141ab53,
      0x2748774c, 0xdf8eeb99, 0x34b0bcb5, 0xe19b48a8,
      0x391c0cb3, 0xc5c95a63, 0x4ed8aa4a, 0xe3418acb,
      0x5b9cca4f, 0x7763e373, 0x682e6ff3, 0xd6b2b8a3,
      0x748f82ee, 0x5defb2fc, 0x78a5636f, 0x43172f60,
      0x84c87814, 0xa1f0ab72, 0x8cc70208, 0x1a6439ec,
      0x90befffa, 0x23631e28, 0xa4506ceb, 0xde82bde9,
      0xbef9a3f7, 0xb2c67915, 0xc67178f2, 0xe372532b,
      0xca273ece, 0xea26619c, 0xd186b8c7, 0x21c0c207,
      0xeada7dd6, 0xcde0eb1e, 0xf57d4f7f, 0xee6ed178,
      0x06f067aa, 0x72176fba, 0x0a637dc5, 0xa2c898a6,
      0x113f9804, 0xbef90dae, 0x1b710b35, 0x131c471b,
      0x28db77f5, 0x23047d84, 0x32caab7b, 0x40c72493,
      0x3c9ebe0a, 0x15c9bebc, 0x431d67c4, 0x9c100d4c,
      0x4cc5d4be, 0xcb3e42b6, 0x597f299c, 0xfc657e2a,
      0x5fcb6fab, 0x3ad6faec, 0x6c44198c, 0x4a475817
    ];

    function crypto_hashblocks_hl(hh, hl, m, n) {
      var wh = new Int32Array(16), wl = new Int32Array(16),
          bh0, bh1, bh2, bh3, bh4, bh5, bh6, bh7,
          bl0, bl1, bl2, bl3, bl4, bl5, bl6, bl7,
          th, tl, i, j, h, l, a, b, c, d;

      var ah0 = hh[0],
          ah1 = hh[1],
          ah2 = hh[2],
          ah3 = hh[3],
          ah4 = hh[4],
          ah5 = hh[5],
          ah6 = hh[6],
          ah7 = hh[7],

          al0 = hl[0],
          al1 = hl[1],
          al2 = hl[2],
          al3 = hl[3],
          al4 = hl[4],
          al5 = hl[5],
          al6 = hl[6],
          al7 = hl[7];

      var pos = 0;
      while (n >= 128) {
        for (i = 0; i < 16; i++) {
          j = 8 * i + pos;
          wh[i] = (m[j+0] << 24) | (m[j+1] << 16) | (m[j+2] << 8) | m[j+3];
          wl[i] = (m[j+4] << 24) | (m[j+5] << 16) | (m[j+6] << 8) | m[j+7];
        }
        for (i = 0; i < 80; i++) {
          bh0 = ah0;
          bh1 = ah1;
          bh2 = ah2;
          bh3 = ah3;
          bh4 = ah4;
          bh5 = ah5;
          bh6 = ah6;
          bh7 = ah7;

          bl0 = al0;
          bl1 = al1;
          bl2 = al2;
          bl3 = al3;
          bl4 = al4;
          bl5 = al5;
          bl6 = al6;
          bl7 = al7;

          // add
          h = ah7;
          l = al7;

          a = l & 0xffff; b = l >>> 16;
          c = h & 0xffff; d = h >>> 16;

          // Sigma1
          h = ((ah4 >>> 14) | (al4 << (32-14))) ^ ((ah4 >>> 18) | (al4 << (32-18))) ^ ((al4 >>> (41-32)) | (ah4 << (32-(41-32))));
          l = ((al4 >>> 14) | (ah4 << (32-14))) ^ ((al4 >>> 18) | (ah4 << (32-18))) ^ ((ah4 >>> (41-32)) | (al4 << (32-(41-32))));

          a += l & 0xffff; b += l >>> 16;
          c += h & 0xffff; d += h >>> 16;

          // Ch
          h = (ah4 & ah5) ^ (~ah4 & ah6);
          l = (al4 & al5) ^ (~al4 & al6);

          a += l & 0xffff; b += l >>> 16;
          c += h & 0xffff; d += h >>> 16;

          // K
          h = K[i*2];
          l = K[i*2+1];

          a += l & 0xffff; b += l >>> 16;
          c += h & 0xffff; d += h >>> 16;

          // w
          h = wh[i%16];
          l = wl[i%16];

          a += l & 0xffff; b += l >>> 16;
          c += h & 0xffff; d += h >>> 16;

          b += a >>> 16;
          c += b >>> 16;
          d += c >>> 16;

          th = c & 0xffff | d << 16;
          tl = a & 0xffff | b << 16;

          // add
          h = th;
          l = tl;

          a = l & 0xffff; b = l >>> 16;
          c = h & 0xffff; d = h >>> 16;

          // Sigma0
          h = ((ah0 >>> 28) | (al0 << (32-28))) ^ ((al0 >>> (34-32)) | (ah0 << (32-(34-32)))) ^ ((al0 >>> (39-32)) | (ah0 << (32-(39-32))));
          l = ((al0 >>> 28) | (ah0 << (32-28))) ^ ((ah0 >>> (34-32)) | (al0 << (32-(34-32)))) ^ ((ah0 >>> (39-32)) | (al0 << (32-(39-32))));

          a += l & 0xffff; b += l >>> 16;
          c += h & 0xffff; d += h >>> 16;

          // Maj
          h = (ah0 & ah1) ^ (ah0 & ah2) ^ (ah1 & ah2);
          l = (al0 & al1) ^ (al0 & al2) ^ (al1 & al2);

          a += l & 0xffff; b += l >>> 16;
          c += h & 0xffff; d += h >>> 16;

          b += a >>> 16;
          c += b >>> 16;
          d += c >>> 16;

          bh7 = (c & 0xffff) | (d << 16);
          bl7 = (a & 0xffff) | (b << 16);

          // add
          h = bh3;
          l = bl3;

          a = l & 0xffff; b = l >>> 16;
          c = h & 0xffff; d = h >>> 16;

          h = th;
          l = tl;

          a += l & 0xffff; b += l >>> 16;
          c += h & 0xffff; d += h >>> 16;

          b += a >>> 16;
          c += b >>> 16;
          d += c >>> 16;

          bh3 = (c & 0xffff) | (d << 16);
          bl3 = (a & 0xffff) | (b << 16);

          ah1 = bh0;
          ah2 = bh1;
          ah3 = bh2;
          ah4 = bh3;
          ah5 = bh4;
          ah6 = bh5;
          ah7 = bh6;
          ah0 = bh7;

          al1 = bl0;
          al2 = bl1;
          al3 = bl2;
          al4 = bl3;
          al5 = bl4;
          al6 = bl5;
          al7 = bl6;
          al0 = bl7;

          if (i%16 === 15) {
            for (j = 0; j < 16; j++) {
              // add
              h = wh[j];
              l = wl[j];

              a = l & 0xffff; b = l >>> 16;
              c = h & 0xffff; d = h >>> 16;

              h = wh[(j+9)%16];
              l = wl[(j+9)%16];

              a += l & 0xffff; b += l >>> 16;
              c += h & 0xffff; d += h >>> 16;

              // sigma0
              th = wh[(j+1)%16];
              tl = wl[(j+1)%16];
              h = ((th >>> 1) | (tl << (32-1))) ^ ((th >>> 8) | (tl << (32-8))) ^ (th >>> 7);
              l = ((tl >>> 1) | (th << (32-1))) ^ ((tl >>> 8) | (th << (32-8))) ^ ((tl >>> 7) | (th << (32-7)));

              a += l & 0xffff; b += l >>> 16;
              c += h & 0xffff; d += h >>> 16;

              // sigma1
              th = wh[(j+14)%16];
              tl = wl[(j+14)%16];
              h = ((th >>> 19) | (tl << (32-19))) ^ ((tl >>> (61-32)) | (th << (32-(61-32)))) ^ (th >>> 6);
              l = ((tl >>> 19) | (th << (32-19))) ^ ((th >>> (61-32)) | (tl << (32-(61-32)))) ^ ((tl >>> 6) | (th << (32-6)));

              a += l & 0xffff; b += l >>> 16;
              c += h & 0xffff; d += h >>> 16;

              b += a >>> 16;
              c += b >>> 16;
              d += c >>> 16;

              wh[j] = (c & 0xffff) | (d << 16);
              wl[j] = (a & 0xffff) | (b << 16);
            }
          }
        }

        // add
        h = ah0;
        l = al0;

        a = l & 0xffff; b = l >>> 16;
        c = h & 0xffff; d = h >>> 16;

        h = hh[0];
        l = hl[0];

        a += l & 0xffff; b += l >>> 16;
        c += h & 0xffff; d += h >>> 16;

        b += a >>> 16;
        c += b >>> 16;
        d += c >>> 16;

        hh[0] = ah0 = (c & 0xffff) | (d << 16);
        hl[0] = al0 = (a & 0xffff) | (b << 16);

        h = ah1;
        l = al1;

        a = l & 0xffff; b = l >>> 16;
        c = h & 0xffff; d = h >>> 16;

        h = hh[1];
        l = hl[1];

        a += l & 0xffff; b += l >>> 16;
        c += h & 0xffff; d += h >>> 16;

        b += a >>> 16;
        c += b >>> 16;
        d += c >>> 16;

        hh[1] = ah1 = (c & 0xffff) | (d << 16);
        hl[1] = al1 = (a & 0xffff) | (b << 16);

        h = ah2;
        l = al2;

        a = l & 0xffff; b = l >>> 16;
        c = h & 0xffff; d = h >>> 16;

        h = hh[2];
        l = hl[2];

        a += l & 0xffff; b += l >>> 16;
        c += h & 0xffff; d += h >>> 16;

        b += a >>> 16;
        c += b >>> 16;
        d += c >>> 16;

        hh[2] = ah2 = (c & 0xffff) | (d << 16);
        hl[2] = al2 = (a & 0xffff) | (b << 16);

        h = ah3;
        l = al3;

        a = l & 0xffff; b = l >>> 16;
        c = h & 0xffff; d = h >>> 16;

        h = hh[3];
        l = hl[3];

        a += l & 0xffff; b += l >>> 16;
        c += h & 0xffff; d += h >>> 16;

        b += a >>> 16;
        c += b >>> 16;
        d += c >>> 16;

        hh[3] = ah3 = (c & 0xffff) | (d << 16);
        hl[3] = al3 = (a & 0xffff) | (b << 16);

        h = ah4;
        l = al4;

        a = l & 0xffff; b = l >>> 16;
        c = h & 0xffff; d = h >>> 16;

        h = hh[4];
        l = hl[4];

        a += l & 0xffff; b += l >>> 16;
        c += h & 0xffff; d += h >>> 16;

        b += a >>> 16;
        c += b >>> 16;
        d += c >>> 16;

        hh[4] = ah4 = (c & 0xffff) | (d << 16);
        hl[4] = al4 = (a & 0xffff) | (b << 16);

        h = ah5;
        l = al5;

        a = l & 0xffff; b = l >>> 16;
        c = h & 0xffff; d = h >>> 16;

        h = hh[5];
        l = hl[5];

        a += l & 0xffff; b += l >>> 16;
        c += h & 0xffff; d += h >>> 16;

        b += a >>> 16;
        c += b >>> 16;
        d += c >>> 16;

        hh[5] = ah5 = (c & 0xffff) | (d << 16);
        hl[5] = al5 = (a & 0xffff) | (b << 16);

        h = ah6;
        l = al6;

        a = l & 0xffff; b = l >>> 16;
        c = h & 0xffff; d = h >>> 16;

        h = hh[6];
        l = hl[6];

        a += l & 0xffff; b += l >>> 16;
        c += h & 0xffff; d += h >>> 16;

        b += a >>> 16;
        c += b >>> 16;
        d += c >>> 16;

        hh[6] = ah6 = (c & 0xffff) | (d << 16);
        hl[6] = al6 = (a & 0xffff) | (b << 16);

        h = ah7;
        l = al7;

        a = l & 0xffff; b = l >>> 16;
        c = h & 0xffff; d = h >>> 16;

        h = hh[7];
        l = hl[7];

        a += l & 0xffff; b += l >>> 16;
        c += h & 0xffff; d += h >>> 16;

        b += a >>> 16;
        c += b >>> 16;
        d += c >>> 16;

        hh[7] = ah7 = (c & 0xffff) | (d << 16);
        hl[7] = al7 = (a & 0xffff) | (b << 16);

        pos += 128;
        n -= 128;
      }

      return n;
    }

    function crypto_hash(out, m, n) {
      var hh = new Int32Array(8),
          hl = new Int32Array(8),
          x = new Uint8Array(256),
          i, b = n;

      hh[0] = 0x6a09e667;
      hh[1] = 0xbb67ae85;
      hh[2] = 0x3c6ef372;
      hh[3] = 0xa54ff53a;
      hh[4] = 0x510e527f;
      hh[5] = 0x9b05688c;
      hh[6] = 0x1f83d9ab;
      hh[7] = 0x5be0cd19;

      hl[0] = 0xf3bcc908;
      hl[1] = 0x84caa73b;
      hl[2] = 0xfe94f82b;
      hl[3] = 0x5f1d36f1;
      hl[4] = 0xade682d1;
      hl[5] = 0x2b3e6c1f;
      hl[6] = 0xfb41bd6b;
      hl[7] = 0x137e2179;

      crypto_hashblocks_hl(hh, hl, m, n);
      n %= 128;

      for (i = 0; i < n; i++) x[i] = m[b-n+i];
      x[n] = 128;

      n = 256-128*(n<112?1:0);
      x[n-9] = 0;
      ts64(x, n-8,  (b / 0x20000000) | 0, b << 3);
      crypto_hashblocks_hl(hh, hl, x, n);

      for (i = 0; i < 8; i++) ts64(out, 8*i, hh[i], hl[i]);

      return 0;
    }

    function add(p, q) {
      var a = gf(), b = gf(), c = gf(),
          d = gf(), e = gf(), f = gf(),
          g = gf(), h = gf(), t = gf();

      Z(a, p[1], p[0]);
      Z(t, q[1], q[0]);
      M(a, a, t);
      A(b, p[0], p[1]);
      A(t, q[0], q[1]);
      M(b, b, t);
      M(c, p[3], q[3]);
      M(c, c, D2);
      M(d, p[2], q[2]);
      A(d, d, d);
      Z(e, b, a);
      Z(f, d, c);
      A(g, d, c);
      A(h, b, a);

      M(p[0], e, f);
      M(p[1], h, g);
      M(p[2], g, f);
      M(p[3], e, h);
    }

    function cswap(p, q, b) {
      var i;
      for (i = 0; i < 4; i++) {
        sel25519(p[i], q[i], b);
      }
    }

    function pack(r, p) {
      var tx = gf(), ty = gf(), zi = gf();
      inv25519(zi, p[2]);
      M(tx, p[0], zi);
      M(ty, p[1], zi);
      pack25519(r, ty);
      r[31] ^= par25519(tx) << 7;
    }

    function scalarmult(p, q, s) {
      var b, i;
      set25519(p[0], gf0);
      set25519(p[1], gf1);
      set25519(p[2], gf1);
      set25519(p[3], gf0);
      for (i = 255; i >= 0; --i) {
        b = (s[(i/8)|0] >> (i&7)) & 1;
        cswap(p, q, b);
        add(q, p);
        add(p, p);
        cswap(p, q, b);
      }
    }

    function scalarbase(p, s) {
      var q = [gf(), gf(), gf(), gf()];
      set25519(q[0], X);
      set25519(q[1], Y);
      set25519(q[2], gf1);
      M(q[3], X, Y);
      scalarmult(p, q, s);
    }

    function crypto_sign_keypair(pk, sk, seeded) {
      var d = new Uint8Array(64);
      var p = [gf(), gf(), gf(), gf()];
      var i;

      if (!seeded) randombytes(sk, 32);
      crypto_hash(d, sk, 32);
      d[0] &= 248;
      d[31] &= 127;
      d[31] |= 64;

      scalarbase(p, d);
      pack(pk, p);

      for (i = 0; i < 32; i++) sk[i+32] = pk[i];
      return 0;
    }

    var L = new Float64Array([0xed, 0xd3, 0xf5, 0x5c, 0x1a, 0x63, 0x12, 0x58, 0xd6, 0x9c, 0xf7, 0xa2, 0xde, 0xf9, 0xde, 0x14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x10]);

    function modL(r, x) {
      var carry, i, j, k;
      for (i = 63; i >= 32; --i) {
        carry = 0;
        for (j = i - 32, k = i - 12; j < k; ++j) {
          x[j] += carry - 16 * x[i] * L[j - (i - 32)];
          carry = Math.floor((x[j] + 128) / 256);
          x[j] -= carry * 256;
        }
        x[j] += carry;
        x[i] = 0;
      }
      carry = 0;
      for (j = 0; j < 32; j++) {
        x[j] += carry - (x[31] >> 4) * L[j];
        carry = x[j] >> 8;
        x[j] &= 255;
      }
      for (j = 0; j < 32; j++) x[j] -= carry * L[j];
      for (i = 0; i < 32; i++) {
        x[i+1] += x[i] >> 8;
        r[i] = x[i] & 255;
      }
    }

    function reduce(r) {
      var x = new Float64Array(64), i;
      for (i = 0; i < 64; i++) x[i] = r[i];
      for (i = 0; i < 64; i++) r[i] = 0;
      modL(r, x);
    }

    // Note: difference from C - smlen returned, not passed as argument.
    function crypto_sign(sm, m, n, sk) {
      var d = new Uint8Array(64), h = new Uint8Array(64), r = new Uint8Array(64);
      var i, j, x = new Float64Array(64);
      var p = [gf(), gf(), gf(), gf()];

      crypto_hash(d, sk, 32);
      d[0] &= 248;
      d[31] &= 127;
      d[31] |= 64;

      var smlen = n + 64;
      for (i = 0; i < n; i++) sm[64 + i] = m[i];
      for (i = 0; i < 32; i++) sm[32 + i] = d[32 + i];

      crypto_hash(r, sm.subarray(32), n+32);
      reduce(r);
      scalarbase(p, r);
      pack(sm, p);

      for (i = 32; i < 64; i++) sm[i] = sk[i];
      crypto_hash(h, sm, n + 64);
      reduce(h);

      for (i = 0; i < 64; i++) x[i] = 0;
      for (i = 0; i < 32; i++) x[i] = r[i];
      for (i = 0; i < 32; i++) {
        for (j = 0; j < 32; j++) {
          x[i+j] += h[i] * d[j];
        }
      }

      modL(sm.subarray(32), x);
      return smlen;
    }

    function unpackneg(r, p) {
      var t = gf(), chk = gf(), num = gf(),
          den = gf(), den2 = gf(), den4 = gf(),
          den6 = gf();

      set25519(r[2], gf1);
      unpack25519(r[1], p);
      S(num, r[1]);
      M(den, num, D);
      Z(num, num, r[2]);
      A(den, r[2], den);

      S(den2, den);
      S(den4, den2);
      M(den6, den4, den2);
      M(t, den6, num);
      M(t, t, den);

      pow2523(t, t);
      M(t, t, num);
      M(t, t, den);
      M(t, t, den);
      M(r[0], t, den);

      S(chk, r[0]);
      M(chk, chk, den);
      if (neq25519(chk, num)) M(r[0], r[0], I);

      S(chk, r[0]);
      M(chk, chk, den);
      if (neq25519(chk, num)) return -1;

      if (par25519(r[0]) === (p[31]>>7)) Z(r[0], gf0, r[0]);

      M(r[3], r[0], r[1]);
      return 0;
    }

    function crypto_sign_open(m, sm, n, pk) {
      var i;
      var t = new Uint8Array(32), h = new Uint8Array(64);
      var p = [gf(), gf(), gf(), gf()],
          q = [gf(), gf(), gf(), gf()];

      if (n < 64) return -1;

      if (unpackneg(q, pk)) return -1;

      for (i = 0; i < n; i++) m[i] = sm[i];
      for (i = 0; i < 32; i++) m[i+32] = pk[i];
      crypto_hash(h, m, n);
      reduce(h);
      scalarmult(p, q, h);

      scalarbase(q, sm.subarray(32));
      add(p, q);
      pack(t, p);

      n -= 64;
      if (crypto_verify_32(sm, 0, t, 0)) {
        for (i = 0; i < n; i++) m[i] = 0;
        return -1;
      }

      for (i = 0; i < n; i++) m[i] = sm[i + 64];
      return n;
    }

    var crypto_secretbox_KEYBYTES = 32,
        crypto_secretbox_NONCEBYTES = 24,
        crypto_secretbox_ZEROBYTES = 32,
        crypto_secretbox_BOXZEROBYTES = 16,
        crypto_scalarmult_BYTES = 32,
        crypto_scalarmult_SCALARBYTES = 32,
        crypto_box_PUBLICKEYBYTES = 32,
        crypto_box_SECRETKEYBYTES = 32,
        crypto_box_BEFORENMBYTES = 32,
        crypto_box_NONCEBYTES = crypto_secretbox_NONCEBYTES,
        crypto_box_ZEROBYTES = crypto_secretbox_ZEROBYTES,
        crypto_box_BOXZEROBYTES = crypto_secretbox_BOXZEROBYTES,
        crypto_sign_BYTES = 64,
        crypto_sign_PUBLICKEYBYTES = 32,
        crypto_sign_SECRETKEYBYTES = 64,
        crypto_sign_SEEDBYTES = 32,
        crypto_hash_BYTES = 64;

    nacl.lowlevel = {
      crypto_core_hsalsa20: crypto_core_hsalsa20,
      crypto_stream_xor: crypto_stream_xor,
      crypto_stream: crypto_stream,
      crypto_stream_salsa20_xor: crypto_stream_salsa20_xor,
      crypto_stream_salsa20: crypto_stream_salsa20,
      crypto_onetimeauth: crypto_onetimeauth,
      crypto_onetimeauth_verify: crypto_onetimeauth_verify,
      crypto_verify_16: crypto_verify_16,
      crypto_verify_32: crypto_verify_32,
      crypto_secretbox: crypto_secretbox,
      crypto_secretbox_open: crypto_secretbox_open,
      crypto_scalarmult: crypto_scalarmult,
      crypto_scalarmult_base: crypto_scalarmult_base,
      crypto_box_beforenm: crypto_box_beforenm,
      crypto_box_afternm: crypto_box_afternm,
      crypto_box: crypto_box,
      crypto_box_open: crypto_box_open,
      crypto_box_keypair: crypto_box_keypair,
      crypto_hash: crypto_hash,
      crypto_sign: crypto_sign,
      crypto_sign_keypair: crypto_sign_keypair,
      crypto_sign_open: crypto_sign_open,

      crypto_secretbox_KEYBYTES: crypto_secretbox_KEYBYTES,
      crypto_secretbox_NONCEBYTES: crypto_secretbox_NONCEBYTES,
      crypto_secretbox_ZEROBYTES: crypto_secretbox_ZEROBYTES,
      crypto_secretbox_BOXZEROBYTES: crypto_secretbox_BOXZEROBYTES,
      crypto_scalarmult_BYTES: crypto_scalarmult_BYTES,
      crypto_scalarmult_SCALARBYTES: crypto_scalarmult_SCALARBYTES,
      crypto_box_PUBLICKEYBYTES: crypto_box_PUBLICKEYBYTES,
      crypto_box_SECRETKEYBYTES: crypto_box_SECRETKEYBYTES,
      crypto_box_BEFORENMBYTES: crypto_box_BEFORENMBYTES,
      crypto_box_NONCEBYTES: crypto_box_NONCEBYTES,
      crypto_box_ZEROBYTES: crypto_box_ZEROBYTES,
      crypto_box_BOXZEROBYTES: crypto_box_BOXZEROBYTES,
      crypto_sign_BYTES: crypto_sign_BYTES,
      crypto_sign_PUBLICKEYBYTES: crypto_sign_PUBLICKEYBYTES,
      crypto_sign_SECRETKEYBYTES: crypto_sign_SECRETKEYBYTES,
      crypto_sign_SEEDBYTES: crypto_sign_SEEDBYTES,
      crypto_hash_BYTES: crypto_hash_BYTES,

      gf: gf,
      D: D,
      L: L,
      pack25519: pack25519,
      unpack25519: unpack25519,
      M: M,
      A: A,
      S: S,
      Z: Z,
      pow2523: pow2523,
      add: add,
      set25519: set25519,
      modL: modL,
      scalarmult: scalarmult,
      scalarbase: scalarbase,
    };

    /* High-level API */

    function checkLengths(k, n) {
      if (k.length !== crypto_secretbox_KEYBYTES) throw new Error('bad key size');
      if (n.length !== crypto_secretbox_NONCEBYTES) throw new Error('bad nonce size');
    }

    function checkBoxLengths(pk, sk) {
      if (pk.length !== crypto_box_PUBLICKEYBYTES) throw new Error('bad public key size');
      if (sk.length !== crypto_box_SECRETKEYBYTES) throw new Error('bad secret key size');
    }

    function checkArrayTypes() {
      for (var i = 0; i < arguments.length; i++) {
        if (!(arguments[i] instanceof Uint8Array))
          throw new TypeError('unexpected type, use Uint8Array');
      }
    }

    function cleanup(arr) {
      for (var i = 0; i < arr.length; i++) arr[i] = 0;
    }

    nacl.randomBytes = function(n) {
      var b = new Uint8Array(n);
      randombytes(b, n);
      return b;
    };

    nacl.secretbox = function(msg, nonce, key) {
      checkArrayTypes(msg, nonce, key);
      checkLengths(key, nonce);
      var m = new Uint8Array(crypto_secretbox_ZEROBYTES + msg.length);
      var c = new Uint8Array(m.length);
      for (var i = 0; i < msg.length; i++) m[i+crypto_secretbox_ZEROBYTES] = msg[i];
      crypto_secretbox(c, m, m.length, nonce, key);
      return c.subarray(crypto_secretbox_BOXZEROBYTES);
    };

    nacl.secretbox.open = function(box, nonce, key) {
      checkArrayTypes(box, nonce, key);
      checkLengths(key, nonce);
      var c = new Uint8Array(crypto_secretbox_BOXZEROBYTES + box.length);
      var m = new Uint8Array(c.length);
      for (var i = 0; i < box.length; i++) c[i+crypto_secretbox_BOXZEROBYTES] = box[i];
      if (c.length < 32) return null;
      if (crypto_secretbox_open(m, c, c.length, nonce, key) !== 0) return null;
      return m.subarray(crypto_secretbox_ZEROBYTES);
    };

    nacl.secretbox.keyLength = crypto_secretbox_KEYBYTES;
    nacl.secretbox.nonceLength = crypto_secretbox_NONCEBYTES;
    nacl.secretbox.overheadLength = crypto_secretbox_BOXZEROBYTES;

    nacl.scalarMult = function(n, p) {
      checkArrayTypes(n, p);
      if (n.length !== crypto_scalarmult_SCALARBYTES) throw new Error('bad n size');
      if (p.length !== crypto_scalarmult_BYTES) throw new Error('bad p size');
      var q = new Uint8Array(crypto_scalarmult_BYTES);
      crypto_scalarmult(q, n, p);
      return q;
    };

    nacl.scalarMult.base = function(n) {
      checkArrayTypes(n);
      if (n.length !== crypto_scalarmult_SCALARBYTES) throw new Error('bad n size');
      var q = new Uint8Array(crypto_scalarmult_BYTES);
      crypto_scalarmult_base(q, n);
      return q;
    };

    nacl.scalarMult.scalarLength = crypto_scalarmult_SCALARBYTES;
    nacl.scalarMult.groupElementLength = crypto_scalarmult_BYTES;

    nacl.box = function(msg, nonce, publicKey, secretKey) {
      var k = nacl.box.before(publicKey, secretKey);
      return nacl.secretbox(msg, nonce, k);
    };

    nacl.box.before = function(publicKey, secretKey) {
      checkArrayTypes(publicKey, secretKey);
      checkBoxLengths(publicKey, secretKey);
      var k = new Uint8Array(crypto_box_BEFORENMBYTES);
      crypto_box_beforenm(k, publicKey, secretKey);
      return k;
    };

    nacl.box.after = nacl.secretbox;

    nacl.box.open = function(msg, nonce, publicKey, secretKey) {
      var k = nacl.box.before(publicKey, secretKey);
      return nacl.secretbox.open(msg, nonce, k);
    };

    nacl.box.open.after = nacl.secretbox.open;

    nacl.box.keyPair = function() {
      var pk = new Uint8Array(crypto_box_PUBLICKEYBYTES);
      var sk = new Uint8Array(crypto_box_SECRETKEYBYTES);
      crypto_box_keypair(pk, sk);
      return {publicKey: pk, secretKey: sk};
    };

    nacl.box.keyPair.fromSecretKey = function(secretKey) {
      checkArrayTypes(secretKey);
      if (secretKey.length !== crypto_box_SECRETKEYBYTES)
        throw new Error('bad secret key size');
      var pk = new Uint8Array(crypto_box_PUBLICKEYBYTES);
      crypto_scalarmult_base(pk, secretKey);
      return {publicKey: pk, secretKey: new Uint8Array(secretKey)};
    };

    nacl.box.publicKeyLength = crypto_box_PUBLICKEYBYTES;
    nacl.box.secretKeyLength = crypto_box_SECRETKEYBYTES;
    nacl.box.sharedKeyLength = crypto_box_BEFORENMBYTES;
    nacl.box.nonceLength = crypto_box_NONCEBYTES;
    nacl.box.overheadLength = nacl.secretbox.overheadLength;

    nacl.sign = function(msg, secretKey) {
      checkArrayTypes(msg, secretKey);
      if (secretKey.length !== crypto_sign_SECRETKEYBYTES)
        throw new Error('bad secret key size');
      var signedMsg = new Uint8Array(crypto_sign_BYTES+msg.length);
      crypto_sign(signedMsg, msg, msg.length, secretKey);
      return signedMsg;
    };

    nacl.sign.open = function(signedMsg, publicKey) {
      checkArrayTypes(signedMsg, publicKey);
      if (publicKey.length !== crypto_sign_PUBLICKEYBYTES)
        throw new Error('bad public key size');
      var tmp = new Uint8Array(signedMsg.length);
      var mlen = crypto_sign_open(tmp, signedMsg, signedMsg.length, publicKey);
      if (mlen < 0) return null;
      var m = new Uint8Array(mlen);
      for (var i = 0; i < m.length; i++) m[i] = tmp[i];
      return m;
    };

    nacl.sign.detached = function(msg, secretKey) {
      var signedMsg = nacl.sign(msg, secretKey);
      var sig = new Uint8Array(crypto_sign_BYTES);
      for (var i = 0; i < sig.length; i++) sig[i] = signedMsg[i];
      return sig;
    };

    nacl.sign.detached.verify = function(msg, sig, publicKey) {
      checkArrayTypes(msg, sig, publicKey);
      if (sig.length !== crypto_sign_BYTES)
        throw new Error('bad signature size');
      if (publicKey.length !== crypto_sign_PUBLICKEYBYTES)
        throw new Error('bad public key size');
      var sm = new Uint8Array(crypto_sign_BYTES + msg.length);
      var m = new Uint8Array(crypto_sign_BYTES + msg.length);
      var i;
      for (i = 0; i < crypto_sign_BYTES; i++) sm[i] = sig[i];
      for (i = 0; i < msg.length; i++) sm[i+crypto_sign_BYTES] = msg[i];
      return (crypto_sign_open(m, sm, sm.length, publicKey) >= 0);
    };

    nacl.sign.keyPair = function() {
      var pk = new Uint8Array(crypto_sign_PUBLICKEYBYTES);
      var sk = new Uint8Array(crypto_sign_SECRETKEYBYTES);
      crypto_sign_keypair(pk, sk);
      return {publicKey: pk, secretKey: sk};
    };

    nacl.sign.keyPair.fromSecretKey = function(secretKey) {
      checkArrayTypes(secretKey);
      if (secretKey.length !== crypto_sign_SECRETKEYBYTES)
        throw new Error('bad secret key size');
      var pk = new Uint8Array(crypto_sign_PUBLICKEYBYTES);
      for (var i = 0; i < pk.length; i++) pk[i] = secretKey[32+i];
      return {publicKey: pk, secretKey: new Uint8Array(secretKey)};
    };

    nacl.sign.keyPair.fromSeed = function(seed) {
      checkArrayTypes(seed);
      if (seed.length !== crypto_sign_SEEDBYTES)
        throw new Error('bad seed size');
      var pk = new Uint8Array(crypto_sign_PUBLICKEYBYTES);
      var sk = new Uint8Array(crypto_sign_SECRETKEYBYTES);
      for (var i = 0; i < 32; i++) sk[i] = seed[i];
      crypto_sign_keypair(pk, sk, true);
      return {publicKey: pk, secretKey: sk};
    };

    nacl.sign.publicKeyLength = crypto_sign_PUBLICKEYBYTES;
    nacl.sign.secretKeyLength = crypto_sign_SECRETKEYBYTES;
    nacl.sign.seedLength = crypto_sign_SEEDBYTES;
    nacl.sign.signatureLength = crypto_sign_BYTES;

    nacl.hash = function(msg) {
      checkArrayTypes(msg);
      var h = new Uint8Array(crypto_hash_BYTES);
      crypto_hash(h, msg, msg.length);
      return h;
    };

    nacl.hash.hashLength = crypto_hash_BYTES;

    nacl.verify = function(x, y) {
      checkArrayTypes(x, y);
      // Zero length arguments are considered not equal.
      if (x.length === 0 || y.length === 0) return false;
      if (x.length !== y.length) return false;
      return (vn(x, 0, y, 0, x.length) === 0) ? true : false;
    };

    nacl.setPRNG = function(fn) {
      randombytes = fn;
    };

    (function() {
      // Initialize PRNG if environment provides CSPRNG.
      // If not, methods calling randombytes will throw.
      var crypto = typeof self !== 'undefined' ? (self.crypto || self.msCrypto) : null;
      if (crypto && crypto.getRandomValues) {
        // Browsers.
        var QUOTA = 65536;
        nacl.setPRNG(function(x, n) {
          var i, v = new Uint8Array(n);
          for (i = 0; i < n; i += QUOTA) {
            crypto.getRandomValues(v.subarray(i, i + Math.min(n - i, QUOTA)));
          }
          for (i = 0; i < n; i++) x[i] = v[i];
          cleanup(v);
        });
      } else if (typeof commonjsRequire !== 'undefined') {
        // Node.js.
        crypto = require$$0;
        if (crypto && crypto.randomBytes) {
          nacl.setPRNG(function(x, n) {
            var i, v = crypto.randomBytes(n);
            for (i = 0; i < n; i++) x[i] = v[i];
            cleanup(v);
          });
        }
      }
    })();

    })(module.exports ? module.exports : (self.nacl = self.nacl || {}));
    });

    var nacl = naclFast;

    // base-x encoding / decoding
    // Copyright (c) 2018 base-x contributors
    // Copyright (c) 2014-2018 The Bitcoin Core developers (base58.cpp)
    // Distributed under the MIT software license, see the accompanying
    // file LICENSE or http://www.opensource.org/licenses/mit-license.php.
    function base (ALPHABET) {
      if (ALPHABET.length >= 255) { throw new TypeError('Alphabet too long') }
      var BASE_MAP = new Uint8Array(256);
      for (var j = 0; j < BASE_MAP.length; j++) {
        BASE_MAP[j] = 255;
      }
      for (var i = 0; i < ALPHABET.length; i++) {
        var x = ALPHABET.charAt(i);
        var xc = x.charCodeAt(0);
        if (BASE_MAP[xc] !== 255) { throw new TypeError(x + ' is ambiguous') }
        BASE_MAP[xc] = i;
      }
      var BASE = ALPHABET.length;
      var LEADER = ALPHABET.charAt(0);
      var FACTOR = Math.log(BASE) / Math.log(256); // log(BASE) / log(256), rounded up
      var iFACTOR = Math.log(256) / Math.log(BASE); // log(256) / log(BASE), rounded up
      function encode (source) {
        if (source instanceof Uint8Array) ; else if (ArrayBuffer.isView(source)) {
          source = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
        } else if (Array.isArray(source)) {
          source = Uint8Array.from(source);
        }
        if (!(source instanceof Uint8Array)) { throw new TypeError('Expected Uint8Array') }
        if (source.length === 0) { return '' }
            // Skip & count leading zeroes.
        var zeroes = 0;
        var length = 0;
        var pbegin = 0;
        var pend = source.length;
        while (pbegin !== pend && source[pbegin] === 0) {
          pbegin++;
          zeroes++;
        }
            // Allocate enough space in big-endian base58 representation.
        var size = ((pend - pbegin) * iFACTOR + 1) >>> 0;
        var b58 = new Uint8Array(size);
            // Process the bytes.
        while (pbegin !== pend) {
          var carry = source[pbegin];
                // Apply "b58 = b58 * 256 + ch".
          var i = 0;
          for (var it1 = size - 1; (carry !== 0 || i < length) && (it1 !== -1); it1--, i++) {
            carry += (256 * b58[it1]) >>> 0;
            b58[it1] = (carry % BASE) >>> 0;
            carry = (carry / BASE) >>> 0;
          }
          if (carry !== 0) { throw new Error('Non-zero carry') }
          length = i;
          pbegin++;
        }
            // Skip leading zeroes in base58 result.
        var it2 = size - length;
        while (it2 !== size && b58[it2] === 0) {
          it2++;
        }
            // Translate the result into a string.
        var str = LEADER.repeat(zeroes);
        for (; it2 < size; ++it2) { str += ALPHABET.charAt(b58[it2]); }
        return str
      }
      function decodeUnsafe (source) {
        if (typeof source !== 'string') { throw new TypeError('Expected String') }
        if (source.length === 0) { return new Uint8Array() }
        var psz = 0;
            // Skip and count leading '1's.
        var zeroes = 0;
        var length = 0;
        while (source[psz] === LEADER) {
          zeroes++;
          psz++;
        }
            // Allocate enough space in big-endian base256 representation.
        var size = (((source.length - psz) * FACTOR) + 1) >>> 0; // log(58) / log(256), rounded up.
        var b256 = new Uint8Array(size);
            // Process the characters.
        while (source[psz]) {
                // Find code of next character
          var charCode = source.charCodeAt(psz);
                // Base map can not be indexed using char code
          if (charCode > 255) { return }
                // Decode character
          var carry = BASE_MAP[charCode];
                // Invalid character
          if (carry === 255) { return }
          var i = 0;
          for (var it3 = size - 1; (carry !== 0 || i < length) && (it3 !== -1); it3--, i++) {
            carry += (BASE * b256[it3]) >>> 0;
            b256[it3] = (carry % 256) >>> 0;
            carry = (carry / 256) >>> 0;
          }
          if (carry !== 0) { throw new Error('Non-zero carry') }
          length = i;
          psz++;
        }
            // Skip leading zeroes in b256.
        var it4 = size - length;
        while (it4 !== size && b256[it4] === 0) {
          it4++;
        }
        var vch = new Uint8Array(zeroes + (size - it4));
        var j = zeroes;
        while (it4 !== size) {
          vch[j++] = b256[it4++];
        }
        return vch
      }
      function decode (string) {
        var buffer = decodeUnsafe(string);
        if (buffer) { return buffer }
        throw new Error('Non-base' + BASE + ' character')
      }
      return {
        encode: encode,
        decodeUnsafe: decodeUnsafe,
        decode: decode
      }
    }
    var src = base;

    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

    var bs58 = src(ALPHABET);

    const toB58 = (buffer) => bs58.encode(buffer);
    const fromB58 = (str) => bs58.decode(str);

    function fromB64(base64String) {
      return Uint8Array.from(atob(base64String), (char) => char.charCodeAt(0));
    }
    const CHUNK_SIZE = 8192;
    function toB64(bytes) {
      if (bytes.length < CHUNK_SIZE) {
        return btoa(String.fromCharCode(...bytes));
      }
      let output = "";
      for (var i = 0; i < bytes.length; i += CHUNK_SIZE) {
        const chunk = bytes.slice(i, i + CHUNK_SIZE);
        output += String.fromCharCode(...chunk);
      }
      return btoa(output);
    }

    function fromHEX(hexStr) {
      const normalized = hexStr.startsWith("0x") ? hexStr.slice(2) : hexStr;
      const padded = normalized.length % 2 === 0 ? normalized : `0${normalized}}`;
      const intArr = padded.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) ?? [];
      return Uint8Array.from(intArr);
    }
    function toHEX(bytes) {
      return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");
    }

    function ulebEncode(num) {
      let arr = [];
      let len = 0;
      if (num === 0) {
        return [0];
      }
      while (num > 0) {
        arr[len] = num & 127;
        if (num >>= 7) {
          arr[len] |= 128;
        }
        len += 1;
      }
      return arr;
    }
    function ulebDecode(arr) {
      let total = 0;
      let shift = 0;
      let len = 0;
      while (true) {
        let byte = arr[len];
        len += 1;
        total |= (byte & 127) << shift;
        if ((byte & 128) === 0) {
          break;
        }
        shift += 7;
      }
      return {
        value: total,
        length: len
      };
    }

    class BcsReader {
      /**
       * @param {Uint8Array} data Data to use as a buffer.
       */
      constructor(data) {
        this.bytePosition = 0;
        this.dataView = new DataView(data.buffer);
      }
      /**
       * Shift current cursor position by `bytes`.
       *
       * @param {Number} bytes Number of bytes to
       * @returns {this} Self for possible chaining.
       */
      shift(bytes) {
        this.bytePosition += bytes;
        return this;
      }
      /**
       * Read U8 value from the buffer and shift cursor by 1.
       * @returns
       */
      read8() {
        let value = this.dataView.getUint8(this.bytePosition);
        this.shift(1);
        return value;
      }
      /**
       * Read U16 value from the buffer and shift cursor by 2.
       * @returns
       */
      read16() {
        let value = this.dataView.getUint16(this.bytePosition, true);
        this.shift(2);
        return value;
      }
      /**
       * Read U32 value from the buffer and shift cursor by 4.
       * @returns
       */
      read32() {
        let value = this.dataView.getUint32(this.bytePosition, true);
        this.shift(4);
        return value;
      }
      /**
       * Read U64 value from the buffer and shift cursor by 8.
       * @returns
       */
      read64() {
        let value1 = this.read32();
        let value2 = this.read32();
        let result = value2.toString(16) + value1.toString(16).padStart(8, "0");
        return BigInt("0x" + result).toString(10);
      }
      /**
       * Read U128 value from the buffer and shift cursor by 16.
       */
      read128() {
        let value1 = BigInt(this.read64());
        let value2 = BigInt(this.read64());
        let result = value2.toString(16) + value1.toString(16).padStart(16, "0");
        return BigInt("0x" + result).toString(10);
      }
      /**
       * Read U128 value from the buffer and shift cursor by 32.
       * @returns
       */
      read256() {
        let value1 = BigInt(this.read128());
        let value2 = BigInt(this.read128());
        let result = value2.toString(16) + value1.toString(16).padStart(32, "0");
        return BigInt("0x" + result).toString(10);
      }
      /**
       * Read `num` number of bytes from the buffer and shift cursor by `num`.
       * @param num Number of bytes to read.
       */
      readBytes(num) {
        let start = this.bytePosition + this.dataView.byteOffset;
        let value = new Uint8Array(this.dataView.buffer, start, num);
        this.shift(num);
        return value;
      }
      /**
       * Read ULEB value - an integer of varying size. Used for enum indexes and
       * vector lengths.
       * @returns {Number} The ULEB value.
       */
      readULEB() {
        let start = this.bytePosition + this.dataView.byteOffset;
        let buffer = new Uint8Array(this.dataView.buffer, start);
        let { value, length } = ulebDecode(buffer);
        this.shift(length);
        return value;
      }
      /**
       * Read a BCS vector: read a length and then apply function `cb` X times
       * where X is the length of the vector, defined as ULEB in BCS bytes.
       * @param cb Callback to process elements of vector.
       * @returns {Array<Any>} Array of the resulting values, returned by callback.
       */
      readVec(cb) {
        let length = this.readULEB();
        let result = [];
        for (let i = 0; i < length; i++) {
          result.push(cb(this, i, length));
        }
        return result;
      }
    }

    function encodeStr(data, encoding) {
      switch (encoding) {
        case "base58":
          return toB58(data);
        case "base64":
          return toB64(data);
        case "hex":
          return toHEX(data);
        default:
          throw new Error("Unsupported encoding, supported values are: base64, hex");
      }
    }
    function decodeStr(data, encoding) {
      switch (encoding) {
        case "base58":
          return fromB58(data);
        case "base64":
          return fromB64(data);
        case "hex":
          return fromHEX(data);
        default:
          throw new Error("Unsupported encoding, supported values are: base64, hex");
      }
    }
    function splitGenericParameters(str, genericSeparators = ["<", ">"]) {
      const [left, right] = genericSeparators;
      const tok = [];
      let word = "";
      let nestedAngleBrackets = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char === left) {
          nestedAngleBrackets++;
        }
        if (char === right) {
          nestedAngleBrackets--;
        }
        if (nestedAngleBrackets === 0 && char === ",") {
          tok.push(word.trim());
          word = "";
          continue;
        }
        word += char;
      }
      tok.push(word.trim());
      return tok;
    }

    class BcsWriter {
      constructor({ size = 1024, maxSize, allocateSize = 1024 } = {}) {
        this.bytePosition = 0;
        this.size = size;
        this.maxSize = maxSize || size;
        this.allocateSize = allocateSize;
        this.dataView = new DataView(new ArrayBuffer(size));
      }
      ensureSizeOrGrow(bytes) {
        const requiredSize = this.bytePosition + bytes;
        if (requiredSize > this.size) {
          const nextSize = Math.min(this.maxSize, this.size + this.allocateSize);
          if (requiredSize > nextSize) {
            throw new Error(
              `Attempting to serialize to BCS, but buffer does not have enough size. Allocated size: ${this.size}, Max size: ${this.maxSize}, Required size: ${requiredSize}`
            );
          }
          this.size = nextSize;
          const nextBuffer = new ArrayBuffer(this.size);
          new Uint8Array(nextBuffer).set(new Uint8Array(this.dataView.buffer));
          this.dataView = new DataView(nextBuffer);
        }
      }
      /**
       * Shift current cursor position by `bytes`.
       *
       * @param {Number} bytes Number of bytes to
       * @returns {this} Self for possible chaining.
       */
      shift(bytes) {
        this.bytePosition += bytes;
        return this;
      }
      /**
       * Write a U8 value into a buffer and shift cursor position by 1.
       * @param {Number} value Value to write.
       * @returns {this}
       */
      write8(value) {
        this.ensureSizeOrGrow(1);
        this.dataView.setUint8(this.bytePosition, Number(value));
        return this.shift(1);
      }
      /**
       * Write a U16 value into a buffer and shift cursor position by 2.
       * @param {Number} value Value to write.
       * @returns {this}
       */
      write16(value) {
        this.ensureSizeOrGrow(2);
        this.dataView.setUint16(this.bytePosition, Number(value), true);
        return this.shift(2);
      }
      /**
       * Write a U32 value into a buffer and shift cursor position by 4.
       * @param {Number} value Value to write.
       * @returns {this}
       */
      write32(value) {
        this.ensureSizeOrGrow(4);
        this.dataView.setUint32(this.bytePosition, Number(value), true);
        return this.shift(4);
      }
      /**
       * Write a U64 value into a buffer and shift cursor position by 8.
       * @param {bigint} value Value to write.
       * @returns {this}
       */
      write64(value) {
        toLittleEndian(BigInt(value), 8).forEach((el) => this.write8(el));
        return this;
      }
      /**
       * Write a U128 value into a buffer and shift cursor position by 16.
       *
       * @param {bigint} value Value to write.
       * @returns {this}
       */
      write128(value) {
        toLittleEndian(BigInt(value), 16).forEach((el) => this.write8(el));
        return this;
      }
      /**
       * Write a U256 value into a buffer and shift cursor position by 16.
       *
       * @param {bigint} value Value to write.
       * @returns {this}
       */
      write256(value) {
        toLittleEndian(BigInt(value), 32).forEach((el) => this.write8(el));
        return this;
      }
      /**
       * Write a ULEB value into a buffer and shift cursor position by number of bytes
       * written.
       * @param {Number} value Value to write.
       * @returns {this}
       */
      writeULEB(value) {
        ulebEncode(value).forEach((el) => this.write8(el));
        return this;
      }
      /**
       * Write a vector into a buffer by first writing the vector length and then calling
       * a callback on each passed value.
       *
       * @param {Array<Any>} vector Array of elements to write.
       * @param {WriteVecCb} cb Callback to call on each element of the vector.
       * @returns {this}
       */
      writeVec(vector, cb) {
        this.writeULEB(vector.length);
        Array.from(vector).forEach((el, i) => cb(this, el, i, vector.length));
        return this;
      }
      /**
       * Adds support for iterations over the object.
       * @returns {Uint8Array}
       */
      *[Symbol.iterator]() {
        for (let i = 0; i < this.bytePosition; i++) {
          yield this.dataView.getUint8(i);
        }
        return this.toBytes();
      }
      /**
       * Get underlying buffer taking only value bytes (in case initial buffer size was bigger).
       * @returns {Uint8Array} Resulting bcs.
       */
      toBytes() {
        return new Uint8Array(this.dataView.buffer.slice(0, this.bytePosition));
      }
      /**
       * Represent data as 'hex' or 'base64'
       * @param encoding Encoding to use: 'base64' or 'hex'
       */
      toString(encoding) {
        return encodeStr(this.toBytes(), encoding);
      }
    }
    function toLittleEndian(bigint, size) {
      let result = new Uint8Array(size);
      let i = 0;
      while (bigint > 0) {
        result[i] = Number(bigint % BigInt(256));
        bigint = bigint / BigInt(256);
        i += 1;
      }
      return result;
    }

    var __accessCheck$5 = (obj, member, msg) => {
      if (!member.has(obj))
        throw TypeError("Cannot " + msg);
    };
    var __privateGet$5 = (obj, member, getter) => {
      __accessCheck$5(obj, member, "read from private field");
      return getter ? getter.call(obj) : member.get(obj);
    };
    var __privateAdd$5 = (obj, member, value) => {
      if (member.has(obj))
        throw TypeError("Cannot add the same private member more than once");
      member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
    };
    var __privateSet$5 = (obj, member, value, setter) => {
      __accessCheck$5(obj, member, "write to private field");
      setter ? setter.call(obj, value) : member.set(obj, value);
      return value;
    };
    var _write, _serialize, _schema, _bytes;
    const _BcsType = class {
      constructor(options) {
        __privateAdd$5(this, _write, void 0);
        __privateAdd$5(this, _serialize, void 0);
        this.name = options.name;
        this.read = options.read;
        this.serializedSize = options.serializedSize ?? (() => null);
        __privateSet$5(this, _write, options.write);
        __privateSet$5(this, _serialize, options.serialize ?? ((value, options2) => {
          const writer = new BcsWriter({ size: this.serializedSize(value) ?? void 0, ...options2 });
          __privateGet$5(this, _write).call(this, value, writer);
          return writer.toBytes();
        }));
        this.validate = options.validate ?? (() => {
        });
      }
      write(value, writer) {
        this.validate(value);
        __privateGet$5(this, _write).call(this, value, writer);
      }
      serialize(value, options) {
        this.validate(value);
        return new SerializedBcs(this, __privateGet$5(this, _serialize).call(this, value, options));
      }
      parse(bytes) {
        const reader = new BcsReader(bytes);
        return this.read(reader);
      }
      transform({
        name,
        input,
        output
      }) {
        return new _BcsType({
          name: name ?? this.name,
          read: (reader) => output(this.read(reader)),
          write: (value, writer) => __privateGet$5(this, _write).call(this, input(value), writer),
          serializedSize: (value) => this.serializedSize(input(value)),
          serialize: (value, options) => __privateGet$5(this, _serialize).call(this, input(value), options),
          validate: (value) => this.validate(input(value))
        });
      }
    };
    let BcsType = _BcsType;
    _write = new WeakMap();
    _serialize = new WeakMap();
    const SERIALIZED_BCS_BRAND = Symbol.for("@mysten/serialized-bcs");
    function isSerializedBcs(obj) {
      return !!obj && typeof obj === "object" && obj[SERIALIZED_BCS_BRAND] === true;
    }
    class SerializedBcs {
      constructor(type, schema) {
        __privateAdd$5(this, _schema, void 0);
        __privateAdd$5(this, _bytes, void 0);
        __privateSet$5(this, _schema, type);
        __privateSet$5(this, _bytes, schema);
      }
      // Used to brand SerializedBcs so that they can be identified, even between multiple copies
      // of the @mysten/bcs package are installed
      get [SERIALIZED_BCS_BRAND]() {
        return true;
      }
      toBytes() {
        return __privateGet$5(this, _bytes);
      }
      toHex() {
        return toHEX(__privateGet$5(this, _bytes));
      }
      toBase64() {
        return toB64(__privateGet$5(this, _bytes));
      }
      toBase58() {
        return toB58(__privateGet$5(this, _bytes));
      }
      parse() {
        return __privateGet$5(this, _schema).parse(__privateGet$5(this, _bytes));
      }
    }
    _schema = new WeakMap();
    _bytes = new WeakMap();
    function fixedSizeBcsType({
      size,
      ...options
    }) {
      return new BcsType({
        ...options,
        serializedSize: () => size
      });
    }
    function uIntBcsType({
      readMethod,
      writeMethod,
      ...options
    }) {
      return fixedSizeBcsType({
        ...options,
        read: (reader) => reader[readMethod](),
        write: (value, writer) => writer[writeMethod](value),
        validate: (value) => {
          if (value < 0 || value > options.maxValue) {
            throw new TypeError(
              `Invalid ${options.name} value: ${value}. Expected value in range 0-${options.maxValue}`
            );
          }
          options.validate?.(value);
        }
      });
    }
    function bigUIntBcsType({
      readMethod,
      writeMethod,
      ...options
    }) {
      return fixedSizeBcsType({
        ...options,
        read: (reader) => reader[readMethod](),
        write: (value, writer) => writer[writeMethod](BigInt(value)),
        validate: (val) => {
          const value = BigInt(val);
          if (value < 0 || value > options.maxValue) {
            throw new TypeError(
              `Invalid ${options.name} value: ${value}. Expected value in range 0-${options.maxValue}`
            );
          }
          options.validate?.(value);
        }
      });
    }
    function dynamicSizeBcsType({
      serialize,
      ...options
    }) {
      const type = new BcsType({
        ...options,
        serialize,
        write: (value, writer) => {
          for (const byte of type.serialize(value).toBytes()) {
            writer.write8(byte);
          }
        }
      });
      return type;
    }
    function stringLikeBcsType({
      toBytes,
      fromBytes,
      ...options
    }) {
      return new BcsType({
        ...options,
        read: (reader) => {
          const length = reader.readULEB();
          const bytes = reader.readBytes(length);
          return fromBytes(bytes);
        },
        write: (hex, writer) => {
          const bytes = toBytes(hex);
          writer.writeULEB(bytes.length);
          for (let i = 0; i < bytes.length; i++) {
            writer.write8(bytes[i]);
          }
        },
        serialize: (value) => {
          const bytes = toBytes(value);
          const size = ulebEncode(bytes.length);
          const result = new Uint8Array(size.length + bytes.length);
          result.set(size, 0);
          result.set(bytes, size.length);
          return result;
        },
        validate: (value) => {
          if (typeof value !== "string") {
            throw new TypeError(`Invalid ${options.name} value: ${value}. Expected string`);
          }
          options.validate?.(value);
        }
      });
    }
    function lazyBcsType(cb) {
      let lazyType = null;
      function getType() {
        if (!lazyType) {
          lazyType = cb();
        }
        return lazyType;
      }
      return new BcsType({
        name: "lazy",
        read: (data) => getType().read(data),
        serializedSize: (value) => getType().serializedSize(value),
        write: (value, writer) => getType().write(value, writer),
        serialize: (value, options) => getType().serialize(value, options).toBytes()
      });
    }

    const bcs = {
      /**
       * Creates a BcsType that can be used to read and write an 8-bit unsigned integer.
       * @example
       * bcs.u8().serialize(255).toBytes() // Uint8Array [ 255 ]
       */
      u8(options) {
        return uIntBcsType({
          name: "u8",
          readMethod: "read8",
          writeMethod: "write8",
          size: 1,
          maxValue: 2 ** 8 - 1,
          ...options
        });
      },
      /**
       * Creates a BcsType that can be used to read and write a 16-bit unsigned integer.
       * @example
       * bcs.u16().serialize(65535).toBytes() // Uint8Array [ 255, 255 ]
       */
      u16(options) {
        return uIntBcsType({
          name: "u16",
          readMethod: "read16",
          writeMethod: "write16",
          size: 2,
          maxValue: 2 ** 16 - 1,
          ...options
        });
      },
      /**
       * Creates a BcsType that can be used to read and write a 32-bit unsigned integer.
       * @example
       * bcs.u32().serialize(4294967295).toBytes() // Uint8Array [ 255, 255, 255, 255 ]
       */
      u32(options) {
        return uIntBcsType({
          name: "u32",
          readMethod: "read32",
          writeMethod: "write32",
          size: 4,
          maxValue: 2 ** 32 - 1,
          ...options
        });
      },
      /**
       * Creates a BcsType that can be used to read and write a 64-bit unsigned integer.
       * @example
       * bcs.u64().serialize(1).toBytes() // Uint8Array [ 1, 0, 0, 0, 0, 0, 0, 0 ]
       */
      u64(options) {
        return bigUIntBcsType({
          name: "u64",
          readMethod: "read64",
          writeMethod: "write64",
          size: 8,
          maxValue: 2n ** 64n - 1n,
          ...options
        });
      },
      /**
       * Creates a BcsType that can be used to read and write a 128-bit unsigned integer.
       * @example
       * bcs.u128().serialize(1).toBytes() // Uint8Array [ 1, ..., 0 ]
       */
      u128(options) {
        return bigUIntBcsType({
          name: "u128",
          readMethod: "read128",
          writeMethod: "write128",
          size: 16,
          maxValue: 2n ** 128n - 1n,
          ...options
        });
      },
      /**
       * Creates a BcsType that can be used to read and write a 256-bit unsigned integer.
       * @example
       * bcs.u256().serialize(1).toBytes() // Uint8Array [ 1, ..., 0 ]
       */
      u256(options) {
        return bigUIntBcsType({
          name: "u256",
          readMethod: "read256",
          writeMethod: "write256",
          size: 32,
          maxValue: 2n ** 256n - 1n,
          ...options
        });
      },
      /**
       * Creates a BcsType that can be used to read and write boolean values.
       * @example
       * bcs.bool().serialize(true).toBytes() // Uint8Array [ 1 ]
       */
      bool(options) {
        return fixedSizeBcsType({
          name: "bool",
          size: 1,
          read: (reader) => reader.read8() === 1,
          write: (value, writer) => writer.write8(value ? 1 : 0),
          ...options,
          validate: (value) => {
            options?.validate?.(value);
            if (typeof value !== "boolean") {
              throw new TypeError(`Expected boolean, found ${typeof value}`);
            }
          }
        });
      },
      /**
       * Creates a BcsType that can be used to read and write unsigned LEB encoded integers
       * @example
       *
       */
      uleb128(options) {
        return dynamicSizeBcsType({
          name: "uleb128",
          read: (reader) => reader.readULEB(),
          serialize: (value) => {
            return Uint8Array.from(ulebEncode(value));
          },
          ...options
        });
      },
      /**
       * Creates a BcsType representing a fixed length byte array
       * @param size The number of bytes this types represents
       * @example
       * bcs.bytes(3).serialize(new Uint8Array([1, 2, 3])).toBytes() // Uint8Array [1, 2, 3]
       */
      bytes(size, options) {
        return fixedSizeBcsType({
          name: `bytes[${size}]`,
          size,
          read: (reader) => reader.readBytes(size),
          write: (value, writer) => {
            for (let i = 0; i < size; i++) {
              writer.write8(value[i] ?? 0);
            }
          },
          ...options,
          validate: (value) => {
            options?.validate?.(value);
            if (!("length" in value)) {
              throw new TypeError(`Expected array, found ${typeof value}`);
            }
            if (value.length !== size) {
              throw new TypeError(`Expected array of length ${size}, found ${value.length}`);
            }
          }
        });
      },
      /**
       * Creates a BcsType that can ser/de string values.  Strings will be UTF-8 encoded
       * @example
       * bcs.string().serialize('a').toBytes() // Uint8Array [ 1, 97 ]
       */
      string(options) {
        return stringLikeBcsType({
          name: "string",
          toBytes: (value) => new TextEncoder().encode(value),
          fromBytes: (bytes) => new TextDecoder().decode(bytes),
          ...options
        });
      },
      /**
       * Creates a BcsType that represents a fixed length array of a given type
       * @param size The number of elements in the array
       * @param type The BcsType of each element in the array
       * @example
       * bcs.fixedArray(3, bcs.u8()).serialize([1, 2, 3]).toBytes() // Uint8Array [ 1, 2, 3 ]
       */
      fixedArray(size, type, options) {
        return new BcsType({
          name: `${type.name}[${size}]`,
          read: (reader) => {
            const result = new Array(size);
            for (let i = 0; i < size; i++) {
              result[i] = type.read(reader);
            }
            return result;
          },
          write: (value, writer) => {
            for (const item of value) {
              type.write(item, writer);
            }
          },
          ...options,
          validate: (value) => {
            options?.validate?.(value);
            if (!("length" in value)) {
              throw new TypeError(`Expected array, found ${typeof value}`);
            }
            if (value.length !== size) {
              throw new TypeError(`Expected array of length ${size}, found ${value.length}`);
            }
          }
        });
      },
      /**
       * Creates a BcsType representing an optional value
       * @param type The BcsType of the optional value
       * @example
       * bcs.option(bcs.u8()).serialize(null).toBytes() // Uint8Array [ 0 ]
       * bcs.option(bcs.u8()).serialize(1).toBytes() // Uint8Array [ 1, 1 ]
       */
      option(type) {
        return bcs.enum(`Option<${type.name}>`, {
          None: null,
          Some: type
        }).transform({
          input: (value) => {
            if (value == null) {
              return { None: true };
            }
            return { Some: value };
          },
          output: (value) => {
            if ("Some" in value) {
              return value.Some;
            }
            return null;
          }
        });
      },
      /**
       * Creates a BcsType representing a variable length vector of a given type
       * @param type The BcsType of each element in the vector
       *
       * @example
       * bcs.vector(bcs.u8()).toBytes([1, 2, 3]) // Uint8Array [ 3, 1, 2, 3 ]
       */
      vector(type, options) {
        return new BcsType({
          name: `vector<${type.name}>`,
          read: (reader) => {
            const length = reader.readULEB();
            const result = new Array(length);
            for (let i = 0; i < length; i++) {
              result[i] = type.read(reader);
            }
            return result;
          },
          write: (value, writer) => {
            writer.writeULEB(value.length);
            for (const item of value) {
              type.write(item, writer);
            }
          },
          ...options,
          validate: (value) => {
            options?.validate?.(value);
            if (!("length" in value)) {
              throw new TypeError(`Expected array, found ${typeof value}`);
            }
          }
        });
      },
      /**
       * Creates a BcsType representing a tuple of a given set of types
       * @param types The BcsTypes for each element in the tuple
       *
       * @example
       * const tuple = bcs.tuple([bcs.u8(), bcs.string(), bcs.bool()])
       * tuple.serialize([1, 'a', true]).toBytes() // Uint8Array [ 1, 1, 97, 1 ]
       */
      tuple(types, options) {
        return new BcsType({
          name: `(${types.map((t) => t.name).join(", ")})`,
          serializedSize: (values) => {
            let total = 0;
            for (let i = 0; i < types.length; i++) {
              const size = types[i].serializedSize(values[i]);
              if (size == null) {
                return null;
              }
              total += size;
            }
            return total;
          },
          read: (reader) => {
            const result = [];
            for (const type of types) {
              result.push(type.read(reader));
            }
            return result;
          },
          write: (value, writer) => {
            for (let i = 0; i < types.length; i++) {
              types[i].write(value[i], writer);
            }
          },
          ...options,
          validate: (value) => {
            options?.validate?.(value);
            if (!Array.isArray(value)) {
              throw new TypeError(`Expected array, found ${typeof value}`);
            }
            if (value.length !== types.length) {
              throw new TypeError(`Expected array of length ${types.length}, found ${value.length}`);
            }
          }
        });
      },
      /**
       * Creates a BcsType representing a struct of a given set of fields
       * @param name The name of the struct
       * @param fields The fields of the struct. The order of the fields affects how data is serialized and deserialized
       *
       * @example
       * const struct = bcs.struct('MyStruct', {
       *  a: bcs.u8(),
       *  b: bcs.string(),
       * })
       * struct.serialize({ a: 1, b: 'a' }).toBytes() // Uint8Array [ 1, 1, 97 ]
       */
      struct(name, fields, options) {
        const canonicalOrder = Object.entries(fields);
        return new BcsType({
          name,
          serializedSize: (values) => {
            let total = 0;
            for (const [field, type] of canonicalOrder) {
              const size = type.serializedSize(values[field]);
              if (size == null) {
                return null;
              }
              total += size;
            }
            return total;
          },
          read: (reader) => {
            const result = {};
            for (const [field, type] of canonicalOrder) {
              result[field] = type.read(reader);
            }
            return result;
          },
          write: (value, writer) => {
            for (const [field, type] of canonicalOrder) {
              type.write(value[field], writer);
            }
          },
          ...options,
          validate: (value) => {
            options?.validate?.(value);
            if (typeof value !== "object" || value == null) {
              throw new TypeError(`Expected object, found ${typeof value}`);
            }
          }
        });
      },
      /**
       * Creates a BcsType representing an enum of a given set of options
       * @param name The name of the enum
       * @param values The values of the enum. The order of the values affects how data is serialized and deserialized.
       * null can be used to represent a variant with no data.
       *
       * @example
       * const enum = bcs.enum('MyEnum', {
       *   A: bcs.u8(),
       *   B: bcs.string(),
       *   C: null,
       * })
       * enum.serialize({ A: 1 }).toBytes() // Uint8Array [ 0, 1 ]
       * enum.serialize({ B: 'a' }).toBytes() // Uint8Array [ 1, 1, 97 ]
       * enum.serialize({ C: true }).toBytes() // Uint8Array [ 2 ]
       */
      enum(name, values, options) {
        const canonicalOrder = Object.entries(values);
        return new BcsType({
          name,
          read: (reader) => {
            const index = reader.readULEB();
            const [name2, type] = canonicalOrder[index];
            return {
              [name2]: type?.read(reader) ?? true
            };
          },
          write: (value, writer) => {
            const [name2, val] = Object.entries(value)[0];
            for (let i = 0; i < canonicalOrder.length; i++) {
              const [optionName, optionType] = canonicalOrder[i];
              if (optionName === name2) {
                writer.writeULEB(i);
                optionType?.write(val, writer);
                return;
              }
            }
          },
          ...options,
          validate: (value) => {
            options?.validate?.(value);
            if (typeof value !== "object" || value == null) {
              throw new TypeError(`Expected object, found ${typeof value}`);
            }
            const keys = Object.keys(value);
            if (keys.length !== 1) {
              throw new TypeError(`Expected object with one key, found ${keys.length}`);
            }
            const [name2] = keys;
            if (!Object.hasOwn(values, name2)) {
              throw new TypeError(`Invalid enum variant ${name2}`);
            }
          }
        });
      },
      /**
       * Creates a BcsType representing a map of a given key and value type
       * @param keyType The BcsType of the key
       * @param valueType The BcsType of the value
       * @example
       * const map = bcs.map(bcs.u8(), bcs.string())
       * map.serialize(new Map([[2, 'a']])).toBytes() // Uint8Array [ 1, 2, 1, 97 ]
       */
      map(keyType, valueType) {
        return bcs.vector(bcs.tuple([keyType, valueType])).transform({
          name: `Map<${keyType.name}, ${valueType.name}>`,
          input: (value) => {
            return [...value.entries()];
          },
          output: (value) => {
            const result = /* @__PURE__ */ new Map();
            for (const [key, val] of value) {
              result.set(key, val);
            }
            return result;
          }
        });
      },
      /**
       * @deprecated
       *
       * Generics should be implemented as generic typescript functions instead:
       *
       * ```ts
       * function VecMap<K, V>, (K: BcsType<K>, V: BcsType<V>) {
       *   return bcs.struct('VecMap<K, V>', {
       *     keys: bcs.vector(K),
       *     values: bcs.vector(V),
       *   })
       * }
       * ```
       */
      generic(_names, cb) {
        return (...types) => {
          return cb(...types).transform({
            name: `${cb.name}<${types.map((t) => t.name).join(", ")}>`,
            input: (value) => value,
            output: (value) => value
          });
        };
      },
      /**
       * Creates a BcsType that wraps another BcsType which is lazily evaluated. This is useful for creating recursive types.
       * @param cb A callback that returns the BcsType
       */
      lazy(cb) {
        return lazyBcsType(cb);
      }
    };

    const SUI_ADDRESS_LENGTH$1 = 32;
    const _BCS = class {
      /**
       * Construct a BCS instance with a prepared schema.
       *
       * @param schema A prepared schema with type definitions
       * @param withPrimitives Whether to register primitive types by default
       */
      constructor(schema) {
        /**
         * Map of kind `TypeName => TypeInterface`. Holds all
         * callbacks for (de)serialization of every registered type.
         *
         * If the value stored is a string, it is treated as an alias.
         */
        this.types = /* @__PURE__ */ new Map();
        /**
         * Count temp keys to generate a new one when requested.
         */
        this.counter = 0;
        if (schema instanceof _BCS) {
          this.schema = schema.schema;
          this.types = new Map(schema.types);
          return;
        }
        this.schema = schema;
        this.registerAddressType(_BCS.ADDRESS, schema.addressLength, schema.addressEncoding);
        this.registerVectorType(schema.vectorType);
        if (schema.types && schema.types.structs) {
          for (let name of Object.keys(schema.types.structs)) {
            this.registerStructType(name, schema.types.structs[name]);
          }
        }
        if (schema.types && schema.types.enums) {
          for (let name of Object.keys(schema.types.enums)) {
            this.registerEnumType(name, schema.types.enums[name]);
          }
        }
        if (schema.types && schema.types.aliases) {
          for (let name of Object.keys(schema.types.aliases)) {
            this.registerAlias(name, schema.types.aliases[name]);
          }
        }
        if (schema.withPrimitives !== false) {
          registerPrimitives(this);
        }
      }
      /**
       * Name of the key to use for temporary struct definitions.
       * Returns a temp key + index (for a case when multiple temp
       * structs are processed).
       */
      tempKey() {
        return `bcs-struct-${++this.counter}`;
      }
      /**
       * Serialize data into bcs.
       *
       * @example
       * bcs.registerVectorType('vector<u8>', 'u8');
       *
       * let serialized = BCS
       *   .set('vector<u8>', [1,2,3,4,5,6])
       *   .toBytes();
       *
       * console.assert(toHex(serialized) === '06010203040506');
       *
       * @param type Name of the type to serialize (must be registered) or a struct type.
       * @param data Data to serialize.
       * @param size Serialization buffer size. Default 1024 = 1KB.
       * @return A BCS reader instance. Usually you'd want to call `.toBytes()`
       */
      ser(type, data, options) {
        if (typeof type === "string" || Array.isArray(type)) {
          const { name, params } = this.parseTypeName(type);
          return this.getTypeInterface(name).encode(this, data, options, params);
        }
        if (typeof type === "object") {
          const key = this.tempKey();
          const temp = new _BCS(this);
          return temp.registerStructType(key, type).ser(key, data, options);
        }
        throw new Error(`Incorrect type passed into the '.ser()' function. 
${JSON.stringify(type)}`);
      }
      /**
       * Deserialize BCS into a JS type.
       *
       * @example
       * let num = bcs.ser('u64', '4294967295').toString('hex');
       * let deNum = bcs.de('u64', num, 'hex');
       * console.assert(deNum.toString(10) === '4294967295');
       *
       * @param type Name of the type to deserialize (must be registered) or a struct type definition.
       * @param data Data to deserialize.
       * @param encoding Optional - encoding to use if data is of type String
       * @return Deserialized data.
       */
      de(type, data, encoding) {
        if (typeof data === "string") {
          if (encoding) {
            data = decodeStr(data, encoding);
          } else {
            throw new Error("To pass a string to `bcs.de`, specify encoding");
          }
        }
        if (typeof type === "string" || Array.isArray(type)) {
          const { name, params } = this.parseTypeName(type);
          return this.getTypeInterface(name).decode(this, data, params);
        }
        if (typeof type === "object") {
          const temp = new _BCS(this);
          const key = this.tempKey();
          return temp.registerStructType(key, type).de(key, data, encoding);
        }
        throw new Error(`Incorrect type passed into the '.de()' function. 
${JSON.stringify(type)}`);
      }
      /**
       * Check whether a `TypeInterface` has been loaded for a `type`.
       * @param type Name of the type to check.
       * @returns
       */
      hasType(type) {
        return this.types.has(type);
      }
      /**
       * Create an alias for a type.
       * WARNING: this can potentially lead to recursion
       * @param name Alias to use
       * @param forType Type to reference
       * @returns
       *
       * @example
       * ```
       * let bcs = new BCS(getSuiMoveConfig());
       * bcs.registerAlias('ObjectDigest', BCS.BASE58);
       * let b58_digest = bcs.de('ObjectDigest', '<digest_bytes>', 'base64');
       * ```
       */
      registerAlias(name, forType) {
        this.types.set(name, forType);
        return this;
      }
      /**
       * Method to register new types for BCS internal representation.
       * For each registered type 2 callbacks must be specified and one is optional:
       *
       * - encodeCb(writer, data) - write a way to serialize data with BcsWriter;
       * - decodeCb(reader) - write a way to deserialize data with BcsReader;
       * - validateCb(data) - validate data - either return bool or throw an error
       *
       * @example
       * // our type would be a string that consists only of numbers
       * bcs.registerType('number_string',
       *    (writer, data) => writer.writeVec(data, (w, el) => w.write8(el)),
       *    (reader) => reader.readVec((r) => r.read8()).join(''), // read each value as u8
       *    (value) => /[0-9]+/.test(value) // test that it has at least one digit
       * );
       * console.log(Array.from(bcs.ser('number_string', '12345').toBytes()) == [5,1,2,3,4,5]);
       *
       * @param name
       * @param encodeCb Callback to encode a value.
       * @param decodeCb Callback to decode a value.
       * @param validateCb Optional validator Callback to check type before serialization.
       */
      registerType(typeName, encodeCb, decodeCb, validateCb = () => true) {
        const { name, params: generics } = this.parseTypeName(typeName);
        this.types.set(name, {
          encode(self, data, options, typeParams) {
            const typeMap = generics.reduce((acc, value, index) => {
              return Object.assign(acc, { [value]: typeParams[index] });
            }, {});
            return this._encodeRaw.call(self, new BcsWriter(options), data, typeParams, typeMap);
          },
          decode(self, data, typeParams) {
            const typeMap = generics.reduce((acc, value, index) => {
              return Object.assign(acc, { [value]: typeParams[index] });
            }, {});
            return this._decodeRaw.call(self, new BcsReader(data), typeParams, typeMap);
          },
          // these methods should always be used with caution as they require pre-defined
          // reader and writer and mainly exist to allow multi-field (de)serialization;
          _encodeRaw(writer, data, typeParams, typeMap) {
            if (validateCb(data)) {
              return encodeCb.call(this, writer, data, typeParams, typeMap);
            } else {
              throw new Error(`Validation failed for type ${name}, data: ${data}`);
            }
          },
          _decodeRaw(reader, typeParams, typeMap) {
            return decodeCb.call(this, reader, typeParams, typeMap);
          }
        });
        return this;
      }
      /**
      	 * Method to register BcsType instances to the registry
      	 * Types are registered with a callback that provides BcsType instances for each generic
      	 * passed to the type.
      	 *
      	 * - createType(...generics) - Return a BcsType instance
      	 *
      	 * @example
      	 * // our type would be a string that consists only of numbers
      	 * bcs.registerType('Box<T>', (T) => {
      	 * 		return bcs.struct({
      	 * 			value: T
      	 * 		});
      	 * });
      
      	 * console.log(Array.from(bcs.ser('Box<string>', '12345').toBytes()) == [5,1,2,3,4,5]);
      	 *
      	 * @param name
      	 * @param createType a Callback to create the BcsType with any passed in generics
      	 */
      registerBcsType(typeName, createType) {
        this.registerType(
          typeName,
          (writer, data, typeParams) => {
            const generics = typeParams.map(
              (param) => new BcsType({
                name: String(param),
                write: (data2, writer2) => {
                  const { name, params } = this.parseTypeName(param);
                  const typeInterface = this.getTypeInterface(name);
                  const typeMap = params.reduce((acc, value, index) => {
                    return Object.assign(acc, { [value]: typeParams[index] });
                  }, {});
                  return typeInterface._encodeRaw.call(this, writer2, data2, params, typeMap);
                },
                read: () => {
                  throw new Error("Not implemented");
                }
              })
            );
            createType(...generics).write(data, writer);
            return writer;
          },
          (reader, typeParams) => {
            const generics = typeParams.map(
              (param) => new BcsType({
                name: String(param),
                write: (_data, _writer) => {
                  throw new Error("Not implemented");
                },
                read: (reader2) => {
                  const { name, params } = this.parseTypeName(param);
                  const typeInterface = this.getTypeInterface(name);
                  const typeMap = params.reduce((acc, value, index) => {
                    return Object.assign(acc, { [value]: typeParams[index] });
                  }, {});
                  return typeInterface._decodeRaw.call(this, reader2, params, typeMap);
                }
              })
            );
            return createType(...generics).read(reader);
          }
        );
        return this;
      }
      /**
       * Register an address type which is a sequence of U8s of specified length.
       * @example
       * bcs.registerAddressType('address', SUI_ADDRESS_LENGTH);
       * let addr = bcs.de('address', 'c3aca510c785c7094ac99aeaa1e69d493122444df50bb8a99dfa790c654a79af');
       *
       * @param name Name of the address type.
       * @param length Byte length of the address.
       * @param encoding Encoding to use for the address type
       * @returns
       */
      registerAddressType(name, length, encoding = "hex") {
        switch (encoding) {
          case "base64":
            return this.registerType(
              name,
              function encodeAddress(writer, data) {
                return fromB64(data).reduce((writer2, el) => writer2.write8(el), writer);
              },
              function decodeAddress(reader) {
                return toB64(reader.readBytes(length));
              }
            );
          case "hex":
            return this.registerType(
              name,
              function encodeAddress(writer, data) {
                return fromHEX(data).reduce((writer2, el) => writer2.write8(el), writer);
              },
              function decodeAddress(reader) {
                return toHEX(reader.readBytes(length));
              }
            );
          default:
            throw new Error("Unsupported encoding! Use either hex or base64");
        }
      }
      /**
       * Register custom vector type inside the bcs.
       *
       * @example
       * bcs.registerVectorType('vector<T>'); // generic registration
       * let array = bcs.de('vector<u8>', '06010203040506', 'hex'); // [1,2,3,4,5,6];
       * let again = bcs.ser('vector<u8>', [1,2,3,4,5,6]).toString('hex');
       *
       * @param name Name of the type to register
       * @param elementType Optional name of the inner type of the vector
       * @return Returns self for chaining.
       */
      registerVectorType(typeName) {
        let { name, params } = this.parseTypeName(typeName);
        if (params.length > 1) {
          throw new Error("Vector can have only one type parameter; got " + name);
        }
        return this.registerType(
          typeName,
          function encodeVector(writer, data, typeParams, typeMap) {
            return writer.writeVec(data, (writer2, el) => {
              let elementType = typeParams[0];
              if (!elementType) {
                throw new Error(`Incorrect number of type parameters passed a to vector '${typeName}'`);
              }
              let { name: name2, params: params2 } = this.parseTypeName(elementType);
              if (this.hasType(name2)) {
                return this.getTypeInterface(name2)._encodeRaw.call(this, writer2, el, params2, typeMap);
              }
              if (!(name2 in typeMap)) {
                throw new Error(
                  `Unable to find a matching type definition for ${name2} in vector; make sure you passed a generic`
                );
              }
              let { name: innerName, params: innerParams } = this.parseTypeName(typeMap[name2]);
              return this.getTypeInterface(innerName)._encodeRaw.call(
                this,
                writer2,
                el,
                innerParams,
                typeMap
              );
            });
          },
          function decodeVector(reader, typeParams, typeMap) {
            return reader.readVec((reader2) => {
              let elementType = typeParams[0];
              if (!elementType) {
                throw new Error(`Incorrect number of type parameters passed to a vector '${typeName}'`);
              }
              let { name: name2, params: params2 } = this.parseTypeName(elementType);
              if (this.hasType(name2)) {
                return this.getTypeInterface(name2)._decodeRaw.call(this, reader2, params2, typeMap);
              }
              if (!(name2 in typeMap)) {
                throw new Error(
                  `Unable to find a matching type definition for ${name2} in vector; make sure you passed a generic`
                );
              }
              let { name: innerName, params: innerParams } = this.parseTypeName(typeMap[name2]);
              return this.getTypeInterface(innerName)._decodeRaw.call(
                this,
                reader2,
                innerParams,
                typeMap
              );
            });
          }
        );
      }
      /**
       * Safe method to register a custom Move struct. The first argument is a name of the
       * struct which is only used on the FrontEnd and has no affect on serialization results,
       * and the second is a struct description passed as an Object.
       *
       * The description object MUST have the same order on all of the platforms (ie in Move
       * or in Rust).
       *
       * @example
       * // Move / Rust struct
       * // struct Coin {
       * //   value: u64,
       * //   owner: vector<u8>, // name // Vec<u8> in Rust
       * //   is_locked: bool,
       * // }
       *
       * bcs.registerStructType('Coin', {
       *   value: bcs.U64,
       *   owner: bcs.STRING,
       *   is_locked: bcs.BOOL
       * });
       *
       * // Created in Rust with diem/bcs
       * // let rust_bcs_str = '80d1b105600000000e4269672057616c6c65742047757900';
       * let rust_bcs_str = [ // using an Array here as BCS works with Uint8Array
       *  128, 209, 177,   5,  96,  0,  0,
       *    0,  14,  66, 105, 103, 32, 87,
       *   97, 108, 108, 101, 116, 32, 71,
       *  117, 121,   0
       * ];
       *
       * // Let's encode the value as well
       * let test_set = bcs.ser('Coin', {
       *   owner: 'Big Wallet Guy',
       *   value: '412412400000',
       *   is_locked: false,
       * });
       *
       * console.assert(Array.from(test_set.toBytes()) === rust_bcs_str, 'Whoopsie, result mismatch');
       *
       * @param name Name of the type to register.
       * @param fields Fields of the struct. Must be in the correct order.
       * @return Returns BCS for chaining.
       */
      registerStructType(typeName, fields) {
        for (let key in fields) {
          let internalName = this.tempKey();
          let value = fields[key];
          if (!Array.isArray(value) && typeof value !== "string") {
            fields[key] = internalName;
            this.registerStructType(internalName, value);
          }
        }
        let struct = Object.freeze(fields);
        let canonicalOrder = Object.keys(struct);
        let { name: structName, params: generics } = this.parseTypeName(typeName);
        return this.registerType(
          typeName,
          function encodeStruct(writer, data, typeParams, typeMap) {
            if (!data || data.constructor !== Object) {
              throw new Error(`Expected ${structName} to be an Object, got: ${data}`);
            }
            if (typeParams.length !== generics.length) {
              throw new Error(
                `Incorrect number of generic parameters passed; expected: ${generics.length}, got: ${typeParams.length}`
              );
            }
            for (let key of canonicalOrder) {
              if (!(key in data)) {
                throw new Error(`Struct ${structName} requires field ${key}:${struct[key]}`);
              }
              const { name: fieldType, params: fieldParams } = this.parseTypeName(
                struct[key]
              );
              if (!generics.includes(fieldType)) {
                this.getTypeInterface(fieldType)._encodeRaw.call(
                  this,
                  writer,
                  data[key],
                  fieldParams,
                  typeMap
                );
              } else {
                const paramIdx = generics.indexOf(fieldType);
                let { name, params } = this.parseTypeName(typeParams[paramIdx]);
                if (this.hasType(name)) {
                  this.getTypeInterface(name)._encodeRaw.call(
                    this,
                    writer,
                    data[key],
                    params,
                    typeMap
                  );
                  continue;
                }
                if (!(name in typeMap)) {
                  throw new Error(
                    `Unable to find a matching type definition for ${name} in ${structName}; make sure you passed a generic`
                  );
                }
                let { name: innerName, params: innerParams } = this.parseTypeName(typeMap[name]);
                this.getTypeInterface(innerName)._encodeRaw.call(
                  this,
                  writer,
                  data[key],
                  innerParams,
                  typeMap
                );
              }
            }
            return writer;
          },
          function decodeStruct(reader, typeParams, typeMap) {
            if (typeParams.length !== generics.length) {
              throw new Error(
                `Incorrect number of generic parameters passed; expected: ${generics.length}, got: ${typeParams.length}`
              );
            }
            let result = {};
            for (let key of canonicalOrder) {
              const { name: fieldName, params: fieldParams } = this.parseTypeName(
                struct[key]
              );
              if (!generics.includes(fieldName)) {
                result[key] = this.getTypeInterface(fieldName)._decodeRaw.call(
                  this,
                  reader,
                  fieldParams,
                  typeMap
                );
              } else {
                const paramIdx = generics.indexOf(fieldName);
                let { name, params } = this.parseTypeName(typeParams[paramIdx]);
                if (this.hasType(name)) {
                  result[key] = this.getTypeInterface(name)._decodeRaw.call(
                    this,
                    reader,
                    params,
                    typeMap
                  );
                  continue;
                }
                if (!(name in typeMap)) {
                  throw new Error(
                    `Unable to find a matching type definition for ${name} in ${structName}; make sure you passed a generic`
                  );
                }
                let { name: innerName, params: innerParams } = this.parseTypeName(typeMap[name]);
                result[key] = this.getTypeInterface(innerName)._decodeRaw.call(
                  this,
                  reader,
                  innerParams,
                  typeMap
                );
              }
            }
            return result;
          }
        );
      }
      /**
       * Safe method to register custom enum type where each invariant holds the value of another type.
       * @example
       * bcs.registerStructType('Coin', { value: 'u64' });
       * bcs.registerEnumType('MyEnum', {
       *  single: 'Coin',
       *  multi: 'vector<Coin>',
       *  empty: null
       * });
       *
       * console.log(
       *  bcs.de('MyEnum', 'AICWmAAAAAAA', 'base64'), // { single: { value: 10000000 } }
       *  bcs.de('MyEnum', 'AQIBAAAAAAAAAAIAAAAAAAAA', 'base64')  // { multi: [ { value: 1 }, { value: 2 } ] }
       * )
       *
       * // and serialization
       * bcs.ser('MyEnum', { single: { value: 10000000 } }).toBytes();
       * bcs.ser('MyEnum', { multi: [ { value: 1 }, { value: 2 } ] });
       *
       * @param name
       * @param variants
       */
      registerEnumType(typeName, variants) {
        for (let key in variants) {
          let internalName = this.tempKey();
          let value = variants[key];
          if (value !== null && !Array.isArray(value) && typeof value !== "string") {
            variants[key] = internalName;
            this.registerStructType(internalName, value);
          }
        }
        let struct = Object.freeze(variants);
        let canonicalOrder = Object.keys(struct);
        let { name, params: canonicalTypeParams } = this.parseTypeName(typeName);
        return this.registerType(
          typeName,
          function encodeEnum(writer, data, typeParams, typeMap) {
            if (!data) {
              throw new Error(`Unable to write enum "${name}", missing data.
Received: "${data}"`);
            }
            if (typeof data !== "object") {
              throw new Error(
                `Incorrect data passed into enum "${name}", expected object with properties: "${canonicalOrder.join(
              " | "
            )}".
Received: "${JSON.stringify(data)}"`
              );
            }
            let key = Object.keys(data)[0];
            if (key === void 0) {
              throw new Error(`Empty object passed as invariant of the enum "${name}"`);
            }
            let orderByte = canonicalOrder.indexOf(key);
            if (orderByte === -1) {
              throw new Error(
                `Unknown invariant of the enum "${name}", allowed values: "${canonicalOrder.join(
              " | "
            )}"; received "${key}"`
              );
            }
            let invariant = canonicalOrder[orderByte];
            let invariantType = struct[invariant];
            writer.write8(orderByte);
            if (invariantType === null) {
              return writer;
            }
            let paramIndex = canonicalTypeParams.indexOf(invariantType);
            let typeOrParam = paramIndex === -1 ? invariantType : typeParams[paramIndex];
            {
              let { name: name2, params } = this.parseTypeName(typeOrParam);
              return this.getTypeInterface(name2)._encodeRaw.call(
                this,
                writer,
                data[key],
                params,
                typeMap
              );
            }
          },
          function decodeEnum(reader, typeParams, typeMap) {
            let orderByte = reader.readULEB();
            let invariant = canonicalOrder[orderByte];
            let invariantType = struct[invariant];
            if (orderByte === -1) {
              throw new Error(
                `Decoding type mismatch, expected enum "${name}" invariant index, received "${orderByte}"`
              );
            }
            if (invariantType === null) {
              return { [invariant]: true };
            }
            let paramIndex = canonicalTypeParams.indexOf(invariantType);
            let typeOrParam = paramIndex === -1 ? invariantType : typeParams[paramIndex];
            {
              let { name: name2, params } = this.parseTypeName(typeOrParam);
              return {
                [invariant]: this.getTypeInterface(name2)._decodeRaw.call(this, reader, params, typeMap)
              };
            }
          }
        );
      }
      /**
       * Get a set of encoders/decoders for specific type.
       * Mainly used to define custom type de/serialization logic.
       *
       * @param type
       * @returns {TypeInterface}
       */
      getTypeInterface(type) {
        let typeInterface = this.types.get(type);
        if (typeof typeInterface === "string") {
          let chain = [];
          while (typeof typeInterface === "string") {
            if (chain.includes(typeInterface)) {
              throw new Error(`Recursive definition found: ${chain.join(" -> ")} -> ${typeInterface}`);
            }
            chain.push(typeInterface);
            typeInterface = this.types.get(typeInterface);
          }
        }
        if (typeInterface === void 0) {
          throw new Error(`Type ${type} is not registered`);
        }
        return typeInterface;
      }
      /**
       * Parse a type name and get the type's generics.
       * @example
       * let { typeName, typeParams } = parseTypeName('Option<Coin<SUI>>');
       * // typeName: Option
       * // typeParams: [ 'Coin<SUI>' ]
       *
       * @param name Name of the type to process
       * @returns Object with typeName and typeParams listed as Array
       */
      parseTypeName(name) {
        if (Array.isArray(name)) {
          let [typeName2, ...params2] = name;
          return { name: typeName2, params: params2 };
        }
        if (typeof name !== "string") {
          throw new Error(`Illegal type passed as a name of the type: ${name}`);
        }
        let [left, right] = this.schema.genericSeparators || ["<", ">"];
        let l_bound = name.indexOf(left);
        let r_bound = Array.from(name).reverse().indexOf(right);
        if (l_bound === -1 && r_bound === -1) {
          return { name, params: [] };
        }
        if (l_bound === -1 || r_bound === -1) {
          throw new Error(`Unclosed generic in name '${name}'`);
        }
        let typeName = name.slice(0, l_bound);
        let params = splitGenericParameters(
          name.slice(l_bound + 1, name.length - r_bound - 1),
          this.schema.genericSeparators
        );
        return { name: typeName, params };
      }
    };
    let BCS = _BCS;
    // Predefined types constants
    BCS.U8 = "u8";
    BCS.U16 = "u16";
    BCS.U32 = "u32";
    BCS.U64 = "u64";
    BCS.U128 = "u128";
    BCS.U256 = "u256";
    BCS.BOOL = "bool";
    BCS.VECTOR = "vector";
    BCS.ADDRESS = "address";
    BCS.STRING = "string";
    BCS.HEX = "hex-string";
    BCS.BASE58 = "base58-string";
    BCS.BASE64 = "base64-string";
    function registerPrimitives(bcs) {
      bcs.registerType(
        BCS.U8,
        function(writer, data) {
          return writer.write8(data);
        },
        function(reader) {
          return reader.read8();
        },
        (u8) => u8 < 256
      );
      bcs.registerType(
        BCS.U16,
        function(writer, data) {
          return writer.write16(data);
        },
        function(reader) {
          return reader.read16();
        },
        (u16) => u16 < 65536
      );
      bcs.registerType(
        BCS.U32,
        function(writer, data) {
          return writer.write32(data);
        },
        function(reader) {
          return reader.read32();
        },
        (u32) => u32 <= 4294967296n
      );
      bcs.registerType(
        BCS.U64,
        function(writer, data) {
          return writer.write64(data);
        },
        function(reader) {
          return reader.read64();
        }
      );
      bcs.registerType(
        BCS.U128,
        function(writer, data) {
          return writer.write128(data);
        },
        function(reader) {
          return reader.read128();
        }
      );
      bcs.registerType(
        BCS.U256,
        function(writer, data) {
          return writer.write256(data);
        },
        function(reader) {
          return reader.read256();
        }
      );
      bcs.registerType(
        BCS.BOOL,
        function(writer, data) {
          return writer.write8(data);
        },
        function(reader) {
          return reader.read8().toString(10) === "1";
        }
      );
      bcs.registerType(
        BCS.STRING,
        function(writer, data) {
          return writer.writeVec(Array.from(data), (writer2, el) => writer2.write8(el.charCodeAt(0)));
        },
        function(reader) {
          return reader.readVec((reader2) => reader2.read8()).map((el) => String.fromCharCode(Number(el))).join("");
        },
        (_str) => true
      );
      bcs.registerType(
        BCS.HEX,
        function(writer, data) {
          return writer.writeVec(Array.from(fromHEX(data)), (writer2, el) => writer2.write8(el));
        },
        function(reader) {
          let bytes = reader.readVec((reader2) => reader2.read8());
          return toHEX(new Uint8Array(bytes));
        }
      );
      bcs.registerType(
        BCS.BASE58,
        function(writer, data) {
          return writer.writeVec(Array.from(fromB58(data)), (writer2, el) => writer2.write8(el));
        },
        function(reader) {
          let bytes = reader.readVec((reader2) => reader2.read8());
          return toB58(new Uint8Array(bytes));
        }
      );
      bcs.registerType(
        BCS.BASE64,
        function(writer, data) {
          return writer.writeVec(Array.from(fromB64(data)), (writer2, el) => writer2.write8(el));
        },
        function(reader) {
          let bytes = reader.readVec((reader2) => reader2.read8());
          return toB64(new Uint8Array(bytes));
        }
      );
    }
    function getSuiMoveConfig() {
      return {
        genericSeparators: ["<", ">"],
        vectorType: "vector",
        addressLength: SUI_ADDRESS_LENGTH$1,
        addressEncoding: "hex"
      };
    }

    /**
     * Utilities for hex, bytes, CSPRNG.
     * @module
     */
    /** Checks if something is Uint8Array. Be careful: nodejs Buffer will return true. */
    function isBytes(a) {
        return a instanceof Uint8Array || (ArrayBuffer.isView(a) && a.constructor.name === 'Uint8Array');
    }
    /** Asserts something is positive integer. */
    function anumber(n) {
        if (!Number.isSafeInteger(n) || n < 0)
            throw new Error('positive integer expected, got ' + n);
    }
    /** Asserts something is Uint8Array. */
    function abytes(b, ...lengths) {
        if (!isBytes(b))
            throw new Error('Uint8Array expected');
        if (lengths.length > 0 && !lengths.includes(b.length))
            throw new Error('Uint8Array expected of length ' + lengths + ', got length=' + b.length);
    }
    /** Asserts something is hash */
    function ahash(h) {
        if (typeof h !== 'function' || typeof h.create !== 'function')
            throw new Error('Hash should be wrapped by utils.createHasher');
        anumber(h.outputLen);
        anumber(h.blockLen);
    }
    /** Asserts a hash instance has not been destroyed / finished */
    function aexists(instance, checkFinished = true) {
        if (instance.destroyed)
            throw new Error('Hash instance has been destroyed');
        if (checkFinished && instance.finished)
            throw new Error('Hash#digest() has already been called');
    }
    /** Asserts output is properly-sized byte array */
    function aoutput(out, instance) {
        abytes(out);
        const min = instance.outputLen;
        if (out.length < min) {
            throw new Error('digestInto() expects output buffer of length at least ' + min);
        }
    }
    /** Cast u8 / u16 / u32 to u32. */
    function u32(arr) {
        return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
    }
    /** Zeroize a byte array. Warning: JS provides no guarantees. */
    function clean(...arrays) {
        for (let i = 0; i < arrays.length; i++) {
            arrays[i].fill(0);
        }
    }
    /** Create DataView of an array for easy byte-level manipulation. */
    function createView(arr) {
        return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
    }
    /** The rotate right (circular right shift) operation for uint32 */
    function rotr(word, shift) {
        return (word << (32 - shift)) | (word >>> shift);
    }
    /** Is current platform little-endian? Most are. Big-Endian platform: IBM */
    const isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([0x11223344]).buffer)[0] === 0x44)();
    /** The byte swap operation for uint32 */
    function byteSwap(word) {
        return (((word << 24) & 0xff000000) |
            ((word << 8) & 0xff0000) |
            ((word >>> 8) & 0xff00) |
            ((word >>> 24) & 0xff));
    }
    /** Conditionally byte swap if on a big-endian platform */
    const swap8IfBE = isLE
        ? (n) => n
        : (n) => byteSwap(n);
    /** In place byte swap for Uint32Array */
    function byteSwap32(arr) {
        for (let i = 0; i < arr.length; i++) {
            arr[i] = byteSwap(arr[i]);
        }
        return arr;
    }
    const swap32IfBE = isLE
        ? (u) => u
        : byteSwap32;
    // Built-in hex conversion https://caniuse.com/mdn-javascript_builtins_uint8array_fromhex
    const hasHexBuiltin = /* @__PURE__ */ (() => 
    // @ts-ignore
    typeof Uint8Array.from([]).toHex === 'function' && typeof Uint8Array.fromHex === 'function')();
    // Array where index 0xf0 (240) is mapped to string 'f0'
    const hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));
    /**
     * Convert byte array to hex string. Uses built-in function, when available.
     * @example bytesToHex(Uint8Array.from([0xca, 0xfe, 0x01, 0x23])) // 'cafe0123'
     */
    function bytesToHex(bytes) {
        abytes(bytes);
        // @ts-ignore
        if (hasHexBuiltin)
            return bytes.toHex();
        // pre-caching improves the speed 6x
        let hex = '';
        for (let i = 0; i < bytes.length; i++) {
            hex += hexes[bytes[i]];
        }
        return hex;
    }
    // We use optimized technique to convert hex string to byte array
    const asciis = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
    function asciiToBase16(ch) {
        if (ch >= asciis._0 && ch <= asciis._9)
            return ch - asciis._0; // '2' => 50-48
        if (ch >= asciis.A && ch <= asciis.F)
            return ch - (asciis.A - 10); // 'B' => 66-(65-10)
        if (ch >= asciis.a && ch <= asciis.f)
            return ch - (asciis.a - 10); // 'b' => 98-(97-10)
        return;
    }
    /**
     * Convert hex string to byte array. Uses built-in function, when available.
     * @example hexToBytes('cafe0123') // Uint8Array.from([0xca, 0xfe, 0x01, 0x23])
     */
    function hexToBytes(hex) {
        if (typeof hex !== 'string')
            throw new Error('hex string expected, got ' + typeof hex);
        // @ts-ignore
        if (hasHexBuiltin)
            return Uint8Array.fromHex(hex);
        const hl = hex.length;
        const al = hl / 2;
        if (hl % 2)
            throw new Error('hex string expected, got unpadded hex of length ' + hl);
        const array = new Uint8Array(al);
        for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
            const n1 = asciiToBase16(hex.charCodeAt(hi));
            const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
            if (n1 === undefined || n2 === undefined) {
                const char = hex[hi] + hex[hi + 1];
                throw new Error('hex string expected, got non-hex character "' + char + '" at index ' + hi);
            }
            array[ai] = n1 * 16 + n2; // multiply first octet, e.g. 'a3' => 10*16+3 => 160 + 3 => 163
        }
        return array;
    }
    /**
     * Converts string to bytes using UTF8 encoding.
     * @example utf8ToBytes('abc') // Uint8Array.from([97, 98, 99])
     */
    function utf8ToBytes(str) {
        if (typeof str !== 'string')
            throw new Error('string expected');
        return new Uint8Array(new TextEncoder().encode(str)); // https://bugzil.la/1681809
    }
    /**
     * Normalizes (non-hex) string or Uint8Array to Uint8Array.
     * Warning: when Uint8Array is passed, it would NOT get copied.
     * Keep in mind for future mutable operations.
     */
    function toBytes(data) {
        if (typeof data === 'string')
            data = utf8ToBytes(data);
        abytes(data);
        return data;
    }
    /**
     * Helper for KDFs: consumes uint8array or string.
     * When string is passed, does utf8 decoding, using TextDecoder.
     */
    function kdfInputToBytes(data) {
        if (typeof data === 'string')
            data = utf8ToBytes(data);
        abytes(data);
        return data;
    }
    function checkOpts(defaults, opts) {
        if (opts !== undefined && {}.toString.call(opts) !== '[object Object]')
            throw new Error('options should be object or undefined');
        const merged = Object.assign(defaults, opts);
        return merged;
    }
    /** For runtime check if class implements interface */
    class Hash {
    }
    /** Wraps hash function, creating an interface on top of it */
    function createHasher(hashCons) {
        const hashC = (msg) => hashCons().update(toBytes(msg)).digest();
        const tmp = hashCons();
        hashC.outputLen = tmp.outputLen;
        hashC.blockLen = tmp.blockLen;
        hashC.create = () => hashCons();
        return hashC;
    }
    function createOptHasher(hashCons) {
        const hashC = (msg, opts) => hashCons(opts).update(toBytes(msg)).digest();
        const tmp = hashCons({});
        hashC.outputLen = tmp.outputLen;
        hashC.blockLen = tmp.blockLen;
        hashC.create = (opts) => hashCons(opts);
        return hashC;
    }

    /**
     * Internal helpers for blake hash.
     * @module
     */
    /**
     * Internal blake variable.
     * For BLAKE2b, the two extra permutations for rounds 10 and 11 are SIGMA[10..11] = SIGMA[0..1].
     */
    // prettier-ignore
    const BSIGMA = /* @__PURE__ */ Uint8Array.from([
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
        14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3,
        11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4,
        7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8,
        9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13,
        2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9,
        12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11,
        13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10,
        6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5,
        10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0,
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
        14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3,
        // Blake1, unused in others
        11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4,
        7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8,
        9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13,
        2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9,
    ]);

    /**
     * Internal Merkle-Damgard hash utils.
     * @module
     */
    /** Polyfill for Safari 14. https://caniuse.com/mdn-javascript_builtins_dataview_setbiguint64 */
    function setBigUint64(view, byteOffset, value, isLE) {
        if (typeof view.setBigUint64 === 'function')
            return view.setBigUint64(byteOffset, value, isLE);
        const _32n = BigInt(32);
        const _u32_max = BigInt(0xffffffff);
        const wh = Number((value >> _32n) & _u32_max);
        const wl = Number(value & _u32_max);
        const h = isLE ? 4 : 0;
        const l = isLE ? 0 : 4;
        view.setUint32(byteOffset + h, wh, isLE);
        view.setUint32(byteOffset + l, wl, isLE);
    }
    /** Choice: a ? b : c */
    function Chi(a, b, c) {
        return (a & b) ^ (~a & c);
    }
    /** Majority function, true if any two inputs is true. */
    function Maj(a, b, c) {
        return (a & b) ^ (a & c) ^ (b & c);
    }
    /**
     * Merkle-Damgard hash construction base class.
     * Could be used to create MD5, RIPEMD, SHA1, SHA2.
     */
    class HashMD extends Hash {
        constructor(blockLen, outputLen, padOffset, isLE) {
            super();
            this.finished = false;
            this.length = 0;
            this.pos = 0;
            this.destroyed = false;
            this.blockLen = blockLen;
            this.outputLen = outputLen;
            this.padOffset = padOffset;
            this.isLE = isLE;
            this.buffer = new Uint8Array(blockLen);
            this.view = createView(this.buffer);
        }
        update(data) {
            aexists(this);
            data = toBytes(data);
            abytes(data);
            const { view, buffer, blockLen } = this;
            const len = data.length;
            for (let pos = 0; pos < len;) {
                const take = Math.min(blockLen - this.pos, len - pos);
                // Fast path: we have at least one block in input, cast it to view and process
                if (take === blockLen) {
                    const dataView = createView(data);
                    for (; blockLen <= len - pos; pos += blockLen)
                        this.process(dataView, pos);
                    continue;
                }
                buffer.set(data.subarray(pos, pos + take), this.pos);
                this.pos += take;
                pos += take;
                if (this.pos === blockLen) {
                    this.process(view, 0);
                    this.pos = 0;
                }
            }
            this.length += data.length;
            this.roundClean();
            return this;
        }
        digestInto(out) {
            aexists(this);
            aoutput(out, this);
            this.finished = true;
            // Padding
            // We can avoid allocation of buffer for padding completely if it
            // was previously not allocated here. But it won't change performance.
            const { buffer, view, blockLen, isLE } = this;
            let { pos } = this;
            // append the bit '1' to the message
            buffer[pos++] = 0b10000000;
            clean(this.buffer.subarray(pos));
            // we have less than padOffset left in buffer, so we cannot put length in
            // current block, need process it and pad again
            if (this.padOffset > blockLen - pos) {
                this.process(view, 0);
                pos = 0;
            }
            // Pad until full block byte with zeros
            for (let i = pos; i < blockLen; i++)
                buffer[i] = 0;
            // Note: sha512 requires length to be 128bit integer, but length in JS will overflow before that
            // You need to write around 2 exabytes (u64_max / 8 / (1024**6)) for this to happen.
            // So we just write lowest 64 bits of that value.
            setBigUint64(view, blockLen - 8, BigInt(this.length * 8), isLE);
            this.process(view, 0);
            const oview = createView(out);
            const len = this.outputLen;
            // NOTE: we do division by 4 later, which should be fused in single op with modulo by JIT
            if (len % 4)
                throw new Error('_sha2: outputLen should be aligned to 32bit');
            const outLen = len / 4;
            const state = this.get();
            if (outLen > state.length)
                throw new Error('_sha2: outputLen bigger than state');
            for (let i = 0; i < outLen; i++)
                oview.setUint32(4 * i, state[i], isLE);
        }
        digest() {
            const { buffer, outputLen } = this;
            this.digestInto(buffer);
            const res = buffer.slice(0, outputLen);
            this.destroy();
            return res;
        }
        _cloneInto(to) {
            to || (to = new this.constructor());
            to.set(...this.get());
            const { blockLen, buffer, length, finished, destroyed, pos } = this;
            to.destroyed = destroyed;
            to.finished = finished;
            to.length = length;
            to.pos = pos;
            if (length % blockLen)
                to.buffer.set(buffer);
            return to;
        }
        clone() {
            return this._cloneInto();
        }
    }
    /**
     * Initial SHA-2 state: fractional parts of square roots of first 16 primes 2..53.
     * Check out `test/misc/sha2-gen-iv.js` for recomputation guide.
     */
    /** Initial SHA256 state. Bits 0..32 of frac part of sqrt of primes 2..19 */
    const SHA256_IV = /* @__PURE__ */ Uint32Array.from([
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ]);
    /** Initial SHA384 state. Bits 0..64 of frac part of sqrt of primes 23..53 */
    const SHA384_IV = /* @__PURE__ */ Uint32Array.from([
        0xcbbb9d5d, 0xc1059ed8, 0x629a292a, 0x367cd507, 0x9159015a, 0x3070dd17, 0x152fecd8, 0xf70e5939,
        0x67332667, 0xffc00b31, 0x8eb44a87, 0x68581511, 0xdb0c2e0d, 0x64f98fa7, 0x47b5481d, 0xbefa4fa4,
    ]);
    /** Initial SHA512 state. Bits 0..64 of frac part of sqrt of primes 2..19 */
    const SHA512_IV = /* @__PURE__ */ Uint32Array.from([
        0x6a09e667, 0xf3bcc908, 0xbb67ae85, 0x84caa73b, 0x3c6ef372, 0xfe94f82b, 0xa54ff53a, 0x5f1d36f1,
        0x510e527f, 0xade682d1, 0x9b05688c, 0x2b3e6c1f, 0x1f83d9ab, 0xfb41bd6b, 0x5be0cd19, 0x137e2179,
    ]);

    /**
     * Internal helpers for u64. BigUint64Array is too slow as per 2025, so we implement it using Uint32Array.
     * @todo re-check https://issues.chromium.org/issues/42212588
     * @module
     */
    const U32_MASK64 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
    const _32n = /* @__PURE__ */ BigInt(32);
    function fromBig(n, le = false) {
        if (le)
            return { h: Number(n & U32_MASK64), l: Number((n >> _32n) & U32_MASK64) };
        return { h: Number((n >> _32n) & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
    }
    function split(lst, le = false) {
        const len = lst.length;
        let Ah = new Uint32Array(len);
        let Al = new Uint32Array(len);
        for (let i = 0; i < len; i++) {
            const { h, l } = fromBig(lst[i], le);
            [Ah[i], Al[i]] = [h, l];
        }
        return [Ah, Al];
    }
    // for Shift in [0, 32)
    const shrSH = (h, _l, s) => h >>> s;
    const shrSL = (h, l, s) => (h << (32 - s)) | (l >>> s);
    // Right rotate for Shift in [1, 32)
    const rotrSH = (h, l, s) => (h >>> s) | (l << (32 - s));
    const rotrSL = (h, l, s) => (h << (32 - s)) | (l >>> s);
    // Right rotate for Shift in (32, 64), NOTE: 32 is special case.
    const rotrBH = (h, l, s) => (h << (64 - s)) | (l >>> (s - 32));
    const rotrBL = (h, l, s) => (h >>> (s - 32)) | (l << (64 - s));
    // Right rotate for shift===32 (just swaps l&h)
    const rotr32H = (_h, l) => l;
    const rotr32L = (h, _l) => h;
    // JS uses 32-bit signed integers for bitwise operations which means we cannot
    // simple take carry out of low bit sum by shift, we need to use division.
    function add(Ah, Al, Bh, Bl) {
        const l = (Al >>> 0) + (Bl >>> 0);
        return { h: (Ah + Bh + ((l / 2 ** 32) | 0)) | 0, l: l | 0 };
    }
    // Addition with more than 2 elements
    const add3L = (Al, Bl, Cl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0);
    const add3H = (low, Ah, Bh, Ch) => (Ah + Bh + Ch + ((low / 2 ** 32) | 0)) | 0;
    const add4L = (Al, Bl, Cl, Dl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0);
    const add4H = (low, Ah, Bh, Ch, Dh) => (Ah + Bh + Ch + Dh + ((low / 2 ** 32) | 0)) | 0;
    const add5L = (Al, Bl, Cl, Dl, El) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0) + (El >>> 0);
    const add5H = (low, Ah, Bh, Ch, Dh, Eh) => (Ah + Bh + Ch + Dh + Eh + ((low / 2 ** 32) | 0)) | 0;

    /**
     * blake2b (64-bit) & blake2s (8 to 32-bit) hash functions.
     * b could have been faster, but there is no fast u64 in js, so s is 1.5x faster.
     * @module
     */
    // Same as SHA512_IV, but swapped endianness: LE instead of BE. iv[1] is iv[0], etc.
    const B2B_IV = /* @__PURE__ */ Uint32Array.from([
        0xf3bcc908, 0x6a09e667, 0x84caa73b, 0xbb67ae85, 0xfe94f82b, 0x3c6ef372, 0x5f1d36f1, 0xa54ff53a,
        0xade682d1, 0x510e527f, 0x2b3e6c1f, 0x9b05688c, 0xfb41bd6b, 0x1f83d9ab, 0x137e2179, 0x5be0cd19,
    ]);
    // Temporary buffer
    const BBUF = /* @__PURE__ */ new Uint32Array(32);
    // Mixing function G splitted in two halfs
    function G1b(a, b, c, d, msg, x) {
        // NOTE: V is LE here
        const Xl = msg[x], Xh = msg[x + 1]; // prettier-ignore
        let Al = BBUF[2 * a], Ah = BBUF[2 * a + 1]; // prettier-ignore
        let Bl = BBUF[2 * b], Bh = BBUF[2 * b + 1]; // prettier-ignore
        let Cl = BBUF[2 * c], Ch = BBUF[2 * c + 1]; // prettier-ignore
        let Dl = BBUF[2 * d], Dh = BBUF[2 * d + 1]; // prettier-ignore
        // v[a] = (v[a] + v[b] + x) | 0;
        let ll = add3L(Al, Bl, Xl);
        Ah = add3H(ll, Ah, Bh, Xh);
        Al = ll | 0;
        // v[d] = rotr(v[d] ^ v[a], 32)
        ({ Dh, Dl } = { Dh: Dh ^ Ah, Dl: Dl ^ Al });
        ({ Dh, Dl } = { Dh: rotr32H(Dh, Dl), Dl: rotr32L(Dh) });
        // v[c] = (v[c] + v[d]) | 0;
        ({ h: Ch, l: Cl } = add(Ch, Cl, Dh, Dl));
        // v[b] = rotr(v[b] ^ v[c], 24)
        ({ Bh, Bl } = { Bh: Bh ^ Ch, Bl: Bl ^ Cl });
        ({ Bh, Bl } = { Bh: rotrSH(Bh, Bl, 24), Bl: rotrSL(Bh, Bl, 24) });
        (BBUF[2 * a] = Al), (BBUF[2 * a + 1] = Ah);
        (BBUF[2 * b] = Bl), (BBUF[2 * b + 1] = Bh);
        (BBUF[2 * c] = Cl), (BBUF[2 * c + 1] = Ch);
        (BBUF[2 * d] = Dl), (BBUF[2 * d + 1] = Dh);
    }
    function G2b(a, b, c, d, msg, x) {
        // NOTE: V is LE here
        const Xl = msg[x], Xh = msg[x + 1]; // prettier-ignore
        let Al = BBUF[2 * a], Ah = BBUF[2 * a + 1]; // prettier-ignore
        let Bl = BBUF[2 * b], Bh = BBUF[2 * b + 1]; // prettier-ignore
        let Cl = BBUF[2 * c], Ch = BBUF[2 * c + 1]; // prettier-ignore
        let Dl = BBUF[2 * d], Dh = BBUF[2 * d + 1]; // prettier-ignore
        // v[a] = (v[a] + v[b] + x) | 0;
        let ll = add3L(Al, Bl, Xl);
        Ah = add3H(ll, Ah, Bh, Xh);
        Al = ll | 0;
        // v[d] = rotr(v[d] ^ v[a], 16)
        ({ Dh, Dl } = { Dh: Dh ^ Ah, Dl: Dl ^ Al });
        ({ Dh, Dl } = { Dh: rotrSH(Dh, Dl, 16), Dl: rotrSL(Dh, Dl, 16) });
        // v[c] = (v[c] + v[d]) | 0;
        ({ h: Ch, l: Cl } = add(Ch, Cl, Dh, Dl));
        // v[b] = rotr(v[b] ^ v[c], 63)
        ({ Bh, Bl } = { Bh: Bh ^ Ch, Bl: Bl ^ Cl });
        ({ Bh, Bl } = { Bh: rotrBH(Bh, Bl, 63), Bl: rotrBL(Bh, Bl, 63) });
        (BBUF[2 * a] = Al), (BBUF[2 * a + 1] = Ah);
        (BBUF[2 * b] = Bl), (BBUF[2 * b + 1] = Bh);
        (BBUF[2 * c] = Cl), (BBUF[2 * c + 1] = Ch);
        (BBUF[2 * d] = Dl), (BBUF[2 * d + 1] = Dh);
    }
    function checkBlake2Opts(outputLen, opts = {}, keyLen, saltLen, persLen) {
        anumber(keyLen);
        if (outputLen < 0 || outputLen > keyLen)
            throw new Error('outputLen bigger than keyLen');
        const { key, salt, personalization } = opts;
        if (key !== undefined && (key.length < 1 || key.length > keyLen))
            throw new Error('key length must be undefined or 1..' + keyLen);
        if (salt !== undefined && salt.length !== saltLen)
            throw new Error('salt must be undefined or ' + saltLen);
        if (personalization !== undefined && personalization.length !== persLen)
            throw new Error('personalization must be undefined or ' + persLen);
    }
    /** Class, from which others are subclassed. */
    class BLAKE2 extends Hash {
        constructor(blockLen, outputLen) {
            super();
            this.finished = false;
            this.destroyed = false;
            this.length = 0;
            this.pos = 0;
            anumber(blockLen);
            anumber(outputLen);
            this.blockLen = blockLen;
            this.outputLen = outputLen;
            this.buffer = new Uint8Array(blockLen);
            this.buffer32 = u32(this.buffer);
        }
        update(data) {
            aexists(this);
            data = toBytes(data);
            abytes(data);
            // Main difference with other hashes: there is flag for last block,
            // so we cannot process current block before we know that there
            // is the next one. This significantly complicates logic and reduces ability
            // to do zero-copy processing
            const { blockLen, buffer, buffer32 } = this;
            const len = data.length;
            const offset = data.byteOffset;
            const buf = data.buffer;
            for (let pos = 0; pos < len;) {
                // If buffer is full and we still have input (don't process last block, same as blake2s)
                if (this.pos === blockLen) {
                    swap32IfBE(buffer32);
                    this.compress(buffer32, 0, false);
                    swap32IfBE(buffer32);
                    this.pos = 0;
                }
                const take = Math.min(blockLen - this.pos, len - pos);
                const dataOffset = offset + pos;
                // full block && aligned to 4 bytes && not last in input
                if (take === blockLen && !(dataOffset % 4) && pos + take < len) {
                    const data32 = new Uint32Array(buf, dataOffset, Math.floor((len - pos) / 4));
                    swap32IfBE(data32);
                    for (let pos32 = 0; pos + blockLen < len; pos32 += buffer32.length, pos += blockLen) {
                        this.length += blockLen;
                        this.compress(data32, pos32, false);
                    }
                    swap32IfBE(data32);
                    continue;
                }
                buffer.set(data.subarray(pos, pos + take), this.pos);
                this.pos += take;
                this.length += take;
                pos += take;
            }
            return this;
        }
        digestInto(out) {
            aexists(this);
            aoutput(out, this);
            const { pos, buffer32 } = this;
            this.finished = true;
            // Padding
            clean(this.buffer.subarray(pos));
            swap32IfBE(buffer32);
            this.compress(buffer32, 0, true);
            swap32IfBE(buffer32);
            const out32 = u32(out);
            this.get().forEach((v, i) => (out32[i] = swap8IfBE(v)));
        }
        digest() {
            const { buffer, outputLen } = this;
            this.digestInto(buffer);
            const res = buffer.slice(0, outputLen);
            this.destroy();
            return res;
        }
        _cloneInto(to) {
            const { buffer, length, finished, destroyed, outputLen, pos } = this;
            to || (to = new this.constructor({ dkLen: outputLen }));
            to.set(...this.get());
            to.buffer.set(buffer);
            to.destroyed = destroyed;
            to.finished = finished;
            to.length = length;
            to.pos = pos;
            // @ts-ignore
            to.outputLen = outputLen;
            return to;
        }
        clone() {
            return this._cloneInto();
        }
    }
    class BLAKE2b extends BLAKE2 {
        constructor(opts = {}) {
            const olen = opts.dkLen === undefined ? 64 : opts.dkLen;
            super(128, olen);
            // Same as SHA-512, but LE
            this.v0l = B2B_IV[0] | 0;
            this.v0h = B2B_IV[1] | 0;
            this.v1l = B2B_IV[2] | 0;
            this.v1h = B2B_IV[3] | 0;
            this.v2l = B2B_IV[4] | 0;
            this.v2h = B2B_IV[5] | 0;
            this.v3l = B2B_IV[6] | 0;
            this.v3h = B2B_IV[7] | 0;
            this.v4l = B2B_IV[8] | 0;
            this.v4h = B2B_IV[9] | 0;
            this.v5l = B2B_IV[10] | 0;
            this.v5h = B2B_IV[11] | 0;
            this.v6l = B2B_IV[12] | 0;
            this.v6h = B2B_IV[13] | 0;
            this.v7l = B2B_IV[14] | 0;
            this.v7h = B2B_IV[15] | 0;
            checkBlake2Opts(olen, opts, 64, 16, 16);
            let { key, personalization, salt } = opts;
            let keyLength = 0;
            if (key !== undefined) {
                key = toBytes(key);
                keyLength = key.length;
            }
            this.v0l ^= this.outputLen | (keyLength << 8) | (0x01 << 16) | (0x01 << 24);
            if (salt !== undefined) {
                salt = toBytes(salt);
                const slt = u32(salt);
                this.v4l ^= swap8IfBE(slt[0]);
                this.v4h ^= swap8IfBE(slt[1]);
                this.v5l ^= swap8IfBE(slt[2]);
                this.v5h ^= swap8IfBE(slt[3]);
            }
            if (personalization !== undefined) {
                personalization = toBytes(personalization);
                const pers = u32(personalization);
                this.v6l ^= swap8IfBE(pers[0]);
                this.v6h ^= swap8IfBE(pers[1]);
                this.v7l ^= swap8IfBE(pers[2]);
                this.v7h ^= swap8IfBE(pers[3]);
            }
            if (key !== undefined) {
                // Pad to blockLen and update
                const tmp = new Uint8Array(this.blockLen);
                tmp.set(key);
                this.update(tmp);
            }
        }
        // prettier-ignore
        get() {
            let { v0l, v0h, v1l, v1h, v2l, v2h, v3l, v3h, v4l, v4h, v5l, v5h, v6l, v6h, v7l, v7h } = this;
            return [v0l, v0h, v1l, v1h, v2l, v2h, v3l, v3h, v4l, v4h, v5l, v5h, v6l, v6h, v7l, v7h];
        }
        // prettier-ignore
        set(v0l, v0h, v1l, v1h, v2l, v2h, v3l, v3h, v4l, v4h, v5l, v5h, v6l, v6h, v7l, v7h) {
            this.v0l = v0l | 0;
            this.v0h = v0h | 0;
            this.v1l = v1l | 0;
            this.v1h = v1h | 0;
            this.v2l = v2l | 0;
            this.v2h = v2h | 0;
            this.v3l = v3l | 0;
            this.v3h = v3h | 0;
            this.v4l = v4l | 0;
            this.v4h = v4h | 0;
            this.v5l = v5l | 0;
            this.v5h = v5h | 0;
            this.v6l = v6l | 0;
            this.v6h = v6h | 0;
            this.v7l = v7l | 0;
            this.v7h = v7h | 0;
        }
        compress(msg, offset, isLast) {
            this.get().forEach((v, i) => (BBUF[i] = v)); // First half from state.
            BBUF.set(B2B_IV, 16); // Second half from IV.
            let { h, l } = fromBig(BigInt(this.length));
            BBUF[24] = B2B_IV[8] ^ l; // Low word of the offset.
            BBUF[25] = B2B_IV[9] ^ h; // High word.
            // Invert all bits for last block
            if (isLast) {
                BBUF[28] = ~BBUF[28];
                BBUF[29] = ~BBUF[29];
            }
            let j = 0;
            const s = BSIGMA;
            for (let i = 0; i < 12; i++) {
                G1b(0, 4, 8, 12, msg, offset + 2 * s[j++]);
                G2b(0, 4, 8, 12, msg, offset + 2 * s[j++]);
                G1b(1, 5, 9, 13, msg, offset + 2 * s[j++]);
                G2b(1, 5, 9, 13, msg, offset + 2 * s[j++]);
                G1b(2, 6, 10, 14, msg, offset + 2 * s[j++]);
                G2b(2, 6, 10, 14, msg, offset + 2 * s[j++]);
                G1b(3, 7, 11, 15, msg, offset + 2 * s[j++]);
                G2b(3, 7, 11, 15, msg, offset + 2 * s[j++]);
                G1b(0, 5, 10, 15, msg, offset + 2 * s[j++]);
                G2b(0, 5, 10, 15, msg, offset + 2 * s[j++]);
                G1b(1, 6, 11, 12, msg, offset + 2 * s[j++]);
                G2b(1, 6, 11, 12, msg, offset + 2 * s[j++]);
                G1b(2, 7, 8, 13, msg, offset + 2 * s[j++]);
                G2b(2, 7, 8, 13, msg, offset + 2 * s[j++]);
                G1b(3, 4, 9, 14, msg, offset + 2 * s[j++]);
                G2b(3, 4, 9, 14, msg, offset + 2 * s[j++]);
            }
            this.v0l ^= BBUF[0] ^ BBUF[16];
            this.v0h ^= BBUF[1] ^ BBUF[17];
            this.v1l ^= BBUF[2] ^ BBUF[18];
            this.v1h ^= BBUF[3] ^ BBUF[19];
            this.v2l ^= BBUF[4] ^ BBUF[20];
            this.v2h ^= BBUF[5] ^ BBUF[21];
            this.v3l ^= BBUF[6] ^ BBUF[22];
            this.v3h ^= BBUF[7] ^ BBUF[23];
            this.v4l ^= BBUF[8] ^ BBUF[24];
            this.v4h ^= BBUF[9] ^ BBUF[25];
            this.v5l ^= BBUF[10] ^ BBUF[26];
            this.v5h ^= BBUF[11] ^ BBUF[27];
            this.v6l ^= BBUF[12] ^ BBUF[28];
            this.v6h ^= BBUF[13] ^ BBUF[29];
            this.v7l ^= BBUF[14] ^ BBUF[30];
            this.v7h ^= BBUF[15] ^ BBUF[31];
            clean(BBUF);
        }
        destroy() {
            this.destroyed = true;
            clean(this.buffer32);
            this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        }
    }
    /**
     * Blake2b hash function. 64-bit. 1.5x slower than blake2s in JS.
     * @param msg - message that would be hashed
     * @param opts - dkLen output length, key for MAC mode, salt, personalization
     */
    const blake2b$1 = /* @__PURE__ */ createOptHasher((opts) => new BLAKE2b(opts));
    SHA256_IV;

    /**
     * Blake2b hash function. Focuses on 64-bit platforms, but in JS speed different from Blake2s is negligible.
     * @module
     * @deprecated
     */
    /** @deprecated Use import from `noble/hashes/blake2` module */
    BLAKE2b;
    /** @deprecated Use import from `noble/hashes/blake2` module */
    const blake2b = blake2b$1;

    var dist = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.bech32m = exports.bech32 = void 0;
    const ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    const ALPHABET_MAP = {};
    for (let z = 0; z < ALPHABET.length; z++) {
        const x = ALPHABET.charAt(z);
        ALPHABET_MAP[x] = z;
    }
    function polymodStep(pre) {
        const b = pre >> 25;
        return (((pre & 0x1ffffff) << 5) ^
            (-((b >> 0) & 1) & 0x3b6a57b2) ^
            (-((b >> 1) & 1) & 0x26508e6d) ^
            (-((b >> 2) & 1) & 0x1ea119fa) ^
            (-((b >> 3) & 1) & 0x3d4233dd) ^
            (-((b >> 4) & 1) & 0x2a1462b3));
    }
    function prefixChk(prefix) {
        let chk = 1;
        for (let i = 0; i < prefix.length; ++i) {
            const c = prefix.charCodeAt(i);
            if (c < 33 || c > 126)
                return 'Invalid prefix (' + prefix + ')';
            chk = polymodStep(chk) ^ (c >> 5);
        }
        chk = polymodStep(chk);
        for (let i = 0; i < prefix.length; ++i) {
            const v = prefix.charCodeAt(i);
            chk = polymodStep(chk) ^ (v & 0x1f);
        }
        return chk;
    }
    function convert(data, inBits, outBits, pad) {
        let value = 0;
        let bits = 0;
        const maxV = (1 << outBits) - 1;
        const result = [];
        for (let i = 0; i < data.length; ++i) {
            value = (value << inBits) | data[i];
            bits += inBits;
            while (bits >= outBits) {
                bits -= outBits;
                result.push((value >> bits) & maxV);
            }
        }
        if (pad) {
            if (bits > 0) {
                result.push((value << (outBits - bits)) & maxV);
            }
        }
        else {
            if (bits >= inBits)
                return 'Excess padding';
            if ((value << (outBits - bits)) & maxV)
                return 'Non-zero padding';
        }
        return result;
    }
    function toWords(bytes) {
        return convert(bytes, 8, 5, true);
    }
    function fromWordsUnsafe(words) {
        const res = convert(words, 5, 8, false);
        if (Array.isArray(res))
            return res;
    }
    function fromWords(words) {
        const res = convert(words, 5, 8, false);
        if (Array.isArray(res))
            return res;
        throw new Error(res);
    }
    function getLibraryFromEncoding(encoding) {
        let ENCODING_CONST;
        if (encoding === 'bech32') {
            ENCODING_CONST = 1;
        }
        else {
            ENCODING_CONST = 0x2bc830a3;
        }
        function encode(prefix, words, LIMIT) {
            LIMIT = LIMIT || 90;
            if (prefix.length + 7 + words.length > LIMIT)
                throw new TypeError('Exceeds length limit');
            prefix = prefix.toLowerCase();
            // determine chk mod
            let chk = prefixChk(prefix);
            if (typeof chk === 'string')
                throw new Error(chk);
            let result = prefix + '1';
            for (let i = 0; i < words.length; ++i) {
                const x = words[i];
                if (x >> 5 !== 0)
                    throw new Error('Non 5-bit word');
                chk = polymodStep(chk) ^ x;
                result += ALPHABET.charAt(x);
            }
            for (let i = 0; i < 6; ++i) {
                chk = polymodStep(chk);
            }
            chk ^= ENCODING_CONST;
            for (let i = 0; i < 6; ++i) {
                const v = (chk >> ((5 - i) * 5)) & 0x1f;
                result += ALPHABET.charAt(v);
            }
            return result;
        }
        function __decode(str, LIMIT) {
            LIMIT = LIMIT || 90;
            if (str.length < 8)
                return str + ' too short';
            if (str.length > LIMIT)
                return 'Exceeds length limit';
            // don't allow mixed case
            const lowered = str.toLowerCase();
            const uppered = str.toUpperCase();
            if (str !== lowered && str !== uppered)
                return 'Mixed-case string ' + str;
            str = lowered;
            const split = str.lastIndexOf('1');
            if (split === -1)
                return 'No separator character for ' + str;
            if (split === 0)
                return 'Missing prefix for ' + str;
            const prefix = str.slice(0, split);
            const wordChars = str.slice(split + 1);
            if (wordChars.length < 6)
                return 'Data too short';
            let chk = prefixChk(prefix);
            if (typeof chk === 'string')
                return chk;
            const words = [];
            for (let i = 0; i < wordChars.length; ++i) {
                const c = wordChars.charAt(i);
                const v = ALPHABET_MAP[c];
                if (v === undefined)
                    return 'Unknown character ' + c;
                chk = polymodStep(chk) ^ v;
                // not in the checksum?
                if (i + 6 >= wordChars.length)
                    continue;
                words.push(v);
            }
            if (chk !== ENCODING_CONST)
                return 'Invalid checksum for ' + str;
            return { prefix, words };
        }
        function decodeUnsafe(str, LIMIT) {
            const res = __decode(str, LIMIT);
            if (typeof res === 'object')
                return res;
        }
        function decode(str, LIMIT) {
            const res = __decode(str, LIMIT);
            if (typeof res === 'object')
                return res;
            throw new Error(res);
        }
        return {
            decodeUnsafe,
            decode,
            encode,
            toWords,
            fromWordsUnsafe,
            fromWords,
        };
    }
    exports.bech32 = getLibraryFromEncoding('bech32');
    exports.bech32m = getLibraryFromEncoding('bech32m');
    });

    var IntentScope$1 = /* @__PURE__ */ ((IntentScope2) => {
      IntentScope2[IntentScope2["TransactionData"] = 0] = "TransactionData";
      IntentScope2[IntentScope2["TransactionEffects"] = 1] = "TransactionEffects";
      IntentScope2[IntentScope2["CheckpointSummary"] = 2] = "CheckpointSummary";
      IntentScope2[IntentScope2["PersonalMessage"] = 3] = "PersonalMessage";
      return IntentScope2;
    })(IntentScope$1 || {});
    function intentWithScope(scope) {
      return [scope, 0 /* V0 */, 0 /* Sui */];
    }
    function messageWithIntent(scope, message) {
      const intent = intentWithScope(scope);
      const intentMessage = new Uint8Array(intent.length + message.length);
      intentMessage.set(intent);
      intentMessage.set(message, intent.length);
      return intentMessage;
    }

    const SIGNATURE_SCHEME_TO_FLAG = {
      ED25519: 0,
      Secp256k1: 1,
      Secp256r1: 2,
      MultiSig: 3,
      ZkLogin: 5
    };
    const SIGNATURE_SCHEME_TO_SIZE = {
      ED25519: 32,
      Secp256k1: 33,
      Secp256r1: 33
    };
    const SIGNATURE_FLAG_TO_SCHEME = {
      0: "ED25519",
      1: "Secp256k1",
      2: "Secp256r1",
      3: "MultiSig",
      5: "ZkLogin"
    };

    const TX_DIGEST_LENGTH = 32;
    function isValidTransactionDigest(value) {
      try {
        const buffer = fromB58(value);
        return buffer.length === TX_DIGEST_LENGTH;
      } catch (e) {
        return false;
      }
    }
    const SUI_ADDRESS_LENGTH = 32;
    function isValidSuiAddress(value) {
      return isHex(value) && getHexByteLength(value) === SUI_ADDRESS_LENGTH;
    }
    function isValidSuiObjectId(value) {
      return isValidSuiAddress(value);
    }
    function normalizeSuiAddress(value, forceAdd0x = false) {
      let address = value.toLowerCase();
      if (!forceAdd0x && address.startsWith("0x")) {
        address = address.slice(2);
      }
      return `0x${address.padStart(SUI_ADDRESS_LENGTH * 2, "0")}`;
    }
    function normalizeSuiObjectId(value, forceAdd0x = false) {
      return normalizeSuiAddress(value, forceAdd0x);
    }
    function isHex(value) {
      return /^(0x|0X)?[a-fA-F0-9]+$/.test(value) && value.length % 2 === 0;
    }
    function getHexByteLength(value) {
      return /^(0x|0X)/.test(value) ? (value.length - 2) / 2 : value.length / 2;
    }

    const VECTOR_REGEX = /^vector<(.+)>$/;
    const STRUCT_REGEX = /^([^:]+)::([^:]+)::([^<]+)(<(.+)>)?/;
    class TypeTagSerializer {
      static parseFromStr(str, normalizeAddress = false) {
        if (str === "address") {
          return { address: null };
        } else if (str === "bool") {
          return { bool: null };
        } else if (str === "u8") {
          return { u8: null };
        } else if (str === "u16") {
          return { u16: null };
        } else if (str === "u32") {
          return { u32: null };
        } else if (str === "u64") {
          return { u64: null };
        } else if (str === "u128") {
          return { u128: null };
        } else if (str === "u256") {
          return { u256: null };
        } else if (str === "signer") {
          return { signer: null };
        }
        const vectorMatch = str.match(VECTOR_REGEX);
        if (vectorMatch) {
          return {
            vector: TypeTagSerializer.parseFromStr(vectorMatch[1], normalizeAddress)
          };
        }
        const structMatch = str.match(STRUCT_REGEX);
        if (structMatch) {
          const address = normalizeAddress ? normalizeSuiAddress(structMatch[1]) : structMatch[1];
          return {
            struct: {
              address,
              module: structMatch[2],
              name: structMatch[3],
              typeParams: structMatch[5] === void 0 ? [] : TypeTagSerializer.parseStructTypeArgs(structMatch[5], normalizeAddress)
            }
          };
        }
        throw new Error(`Encountered unexpected token when parsing type args for ${str}`);
      }
      static parseStructTypeArgs(str, normalizeAddress = false) {
        return splitGenericParameters(str).map(
          (tok) => TypeTagSerializer.parseFromStr(tok, normalizeAddress)
        );
      }
      static tagToString(tag) {
        if ("bool" in tag) {
          return "bool";
        }
        if ("u8" in tag) {
          return "u8";
        }
        if ("u16" in tag) {
          return "u16";
        }
        if ("u32" in tag) {
          return "u32";
        }
        if ("u64" in tag) {
          return "u64";
        }
        if ("u128" in tag) {
          return "u128";
        }
        if ("u256" in tag) {
          return "u256";
        }
        if ("address" in tag) {
          return "address";
        }
        if ("signer" in tag) {
          return "signer";
        }
        if ("vector" in tag) {
          return `vector<${TypeTagSerializer.tagToString(tag.vector)}>`;
        }
        if ("struct" in tag) {
          const struct = tag.struct;
          const typeParams = struct.typeParams.map(TypeTagSerializer.tagToString).join(", ");
          return `${struct.address}::${struct.module}::${struct.name}${typeParams ? `<${typeParams}>` : ""}`;
        }
        throw new Error("Invalid TypeTag");
      }
    }

    const bcsRegistry = new BCS({
      ...getSuiMoveConfig(),
      types: {
        enums: {
          "Option<T>": {
            None: null,
            Some: "T"
          }
        }
      }
    });
    function unsafe_u64(options) {
      return bcs.u64({
        name: "unsafe_u64",
        ...options
      }).transform({
        input: (val) => val,
        output: (val) => Number(val)
      });
    }
    function optionEnum(type) {
      return bcs.enum("Option", {
        None: null,
        Some: type
      });
    }
    function enumKind(type) {
      return type.transform({
        input: (val) => ({
          [val.kind]: val
        }),
        output: (val) => {
          const key = Object.keys(val)[0];
          return { kind: key, ...val[key] };
        }
      });
    }
    const Address = bcs.bytes(SUI_ADDRESS_LENGTH).transform({
      input: (val) => typeof val === "string" ? fromHEX(normalizeSuiAddress(val)) : val,
      output: (val) => normalizeSuiAddress(toHEX(val))
    });
    const ObjectDigest = bcs.vector(bcs.u8()).transform({
      name: "ObjectDigest",
      input: (value) => fromB58(value),
      output: (value) => toB58(new Uint8Array(value))
    });
    const SuiObjectRef$1 = bcs.struct("SuiObjectRef", {
      objectId: Address,
      version: bcs.u64(),
      digest: ObjectDigest
    });
    const SharedObjectRef = bcs.struct("SharedObjectRef", {
      objectId: Address,
      initialSharedVersion: bcs.u64(),
      mutable: bcs.bool()
    });
    const ObjectArg$1 = bcs.enum("ObjectArg", {
      ImmOrOwned: SuiObjectRef$1,
      Shared: SharedObjectRef,
      Receiving: SuiObjectRef$1
    });
    const CallArg = bcs.enum("CallArg", {
      Pure: bcs.vector(bcs.u8()),
      Object: ObjectArg$1,
      ObjVec: bcs.vector(ObjectArg$1)
    });
    const TypeTag = bcs.enum("TypeTag", {
      bool: null,
      u8: null,
      u64: null,
      u128: null,
      address: null,
      signer: null,
      vector: bcs.lazy(() => TypeTag),
      struct: bcs.lazy(() => StructTag),
      u16: null,
      u32: null,
      u256: null
    });
    const Argument = enumKind(
      bcs.enum("Argument", {
        GasCoin: null,
        Input: bcs.struct("Input", { index: bcs.u16() }),
        Result: bcs.struct("Result", { index: bcs.u16() }),
        NestedResult: bcs.struct("NestedResult", { index: bcs.u16(), resultIndex: bcs.u16() })
      })
    );
    const ProgrammableMoveCall = bcs.struct("ProgrammableMoveCall", {
      package: Address,
      module: bcs.string(),
      function: bcs.string(),
      type_arguments: bcs.vector(TypeTag),
      arguments: bcs.vector(Argument)
    }).transform({
      input: (data) => {
        const [pkg, module, fun] = data.target.split("::");
        const type_arguments = data.typeArguments.map(
          (tag) => TypeTagSerializer.parseFromStr(tag, true)
        );
        return {
          package: normalizeSuiAddress(pkg),
          module,
          function: fun,
          type_arguments,
          arguments: data.arguments
        };
      },
      output: (data) => {
        return {
          target: [data.package, data.module, data.function].join(
            "::"
          ),
          arguments: data.arguments,
          typeArguments: data.type_arguments.map(TypeTagSerializer.tagToString)
        };
      }
    });
    const Transaction = enumKind(
      bcs.enum("Transaction", {
        /**
         * A Move Call - any public Move function can be called via
         * this transaction. The results can be used that instant to pass
         * into the next transaction.
         */
        MoveCall: ProgrammableMoveCall,
        /**
         * Transfer vector of objects to a receiver.
         */
        TransferObjects: bcs.struct("TransferObjects", {
          objects: bcs.vector(Argument),
          address: Argument
        }),
        /**
         * Split `amount` from a `coin`.
         */
        SplitCoins: bcs.struct("SplitCoins", { coin: Argument, amounts: bcs.vector(Argument) }),
        /**
         * Merge Vector of Coins (`sources`) into a `destination`.
         */
        MergeCoins: bcs.struct("MergeCoins", { destination: Argument, sources: bcs.vector(Argument) }),
        /**
         * Publish a Move module.
         */
        Publish: bcs.struct("Publish", {
          modules: bcs.vector(bcs.vector(bcs.u8())),
          dependencies: bcs.vector(Address)
        }),
        /**
         * Build a vector of objects using the input arguments.
         * It is impossible to construct a `vector<T: key>` otherwise,
         * so this call serves a utility function.
         */
        MakeMoveVec: bcs.struct("MakeMoveVec", {
          type: optionEnum(TypeTag),
          objects: bcs.vector(Argument)
        }),
        /**  */
        Upgrade: bcs.struct("Upgrade", {
          modules: bcs.vector(bcs.vector(bcs.u8())),
          dependencies: bcs.vector(Address),
          packageId: Address,
          ticket: Argument
        })
      })
    );
    const ProgrammableTransaction = bcs.struct("ProgrammableTransaction", {
      inputs: bcs.vector(CallArg),
      transactions: bcs.vector(Transaction)
    });
    const TransactionKind = bcs.enum("TransactionKind", {
      ProgrammableTransaction,
      ChangeEpoch: null,
      Genesis: null,
      ConsensusCommitPrologue: null
    });
    const TransactionExpiration$1 = bcs.enum("TransactionExpiration", {
      None: null,
      Epoch: unsafe_u64()
    });
    const StructTag = bcs.struct("StructTag", {
      address: Address,
      module: bcs.string(),
      name: bcs.string(),
      typeParams: bcs.vector(TypeTag)
    });
    const GasData = bcs.struct("GasData", {
      payment: bcs.vector(SuiObjectRef$1),
      owner: Address,
      price: bcs.u64(),
      budget: bcs.u64()
    });
    const TransactionDataV1 = bcs.struct("TransactionDataV1", {
      kind: TransactionKind,
      sender: Address,
      gasData: GasData,
      expiration: TransactionExpiration$1
    });
    const TransactionData = bcs.enum("TransactionData", {
      V1: TransactionDataV1
    });
    const IntentScope = bcs.enum("IntentScope", {
      TransactionData: null,
      TransactionEffects: null,
      CheckpointSummary: null,
      PersonalMessage: null
    });
    const IntentVersion = bcs.enum("IntentVersion", {
      V0: null
    });
    const AppId = bcs.enum("AppId", {
      Sui: null
    });
    const Intent = bcs.struct("Intent", {
      scope: IntentScope,
      version: IntentVersion,
      appId: AppId
    });
    const IntentMessage = bcs.generic(
      ["T"],
      (T) => bcs.struct("IntentMessage<T>", {
        intent: Intent,
        value: T
      })
    );
    const CompressedSignature = bcs.enum("CompressedSignature", {
      ED25519: bcs.fixedArray(64, bcs.u8()),
      Secp256k1: bcs.fixedArray(64, bcs.u8()),
      Secp256r1: bcs.fixedArray(64, bcs.u8()),
      ZkLogin: bcs.vector(bcs.u8())
    });
    const PublicKey$1 = bcs.enum("PublicKey", {
      ED25519: bcs.fixedArray(32, bcs.u8()),
      Secp256k1: bcs.fixedArray(33, bcs.u8()),
      Secp256r1: bcs.fixedArray(33, bcs.u8()),
      ZkLogin: bcs.vector(bcs.u8())
    });
    const MultiSigPkMap = bcs.struct("MultiSigPkMap", {
      pubKey: PublicKey$1,
      weight: bcs.u8()
    });
    const MultiSigPublicKey = bcs.struct("MultiSigPublicKey", {
      pk_map: bcs.vector(MultiSigPkMap),
      threshold: bcs.u16()
    });
    const MultiSig = bcs.struct("MultiSig", {
      sigs: bcs.vector(CompressedSignature),
      bitmap: bcs.u16(),
      multisig_pk: MultiSigPublicKey
    });
    const base64String = bcs.vector(bcs.u8()).transform({
      input: (val) => typeof val === "string" ? fromB64(val) : val,
      output: (val) => toB64(new Uint8Array(val))
    });
    const SenderSignedTransaction = bcs.struct("SenderSignedTransaction", {
      intentMessage: IntentMessage(TransactionData),
      txSignatures: bcs.vector(base64String)
    });
    const SenderSignedData = bcs.vector(SenderSignedTransaction, {
      name: "SenderSignedData"
    });
    const suiBcs = {
      ...bcs,
      U8: bcs.u8(),
      U16: bcs.u16(),
      U32: bcs.u32(),
      U64: bcs.u64(),
      U128: bcs.u128(),
      U256: bcs.u256(),
      ULEB128: bcs.uleb128(),
      Bool: bcs.bool(),
      String: bcs.string(),
      Address,
      Argument,
      CallArg,
      CompressedSignature,
      GasData,
      MultiSig,
      MultiSigPkMap,
      MultiSigPublicKey,
      ObjectArg: ObjectArg$1,
      ObjectDigest,
      ProgrammableMoveCall,
      ProgrammableTransaction,
      PublicKey: PublicKey$1,
      SenderSignedData,
      SenderSignedTransaction,
      SharedObjectRef,
      StructTag,
      SuiObjectRef: SuiObjectRef$1,
      Transaction,
      TransactionData,
      TransactionDataV1,
      TransactionExpiration: TransactionExpiration$1,
      TransactionKind,
      TypeTag,
      // preserve backwards compatibility with old bcs export
      ser: bcsRegistry.ser.bind(bcsRegistry),
      de: bcsRegistry.de.bind(bcsRegistry),
      getTypeInterface: bcsRegistry.getTypeInterface.bind(bcsRegistry),
      hasType: bcsRegistry.hasType.bind(bcsRegistry),
      parseTypeName: bcsRegistry.parseTypeName.bind(bcsRegistry),
      registerAddressType: bcsRegistry.registerAddressType.bind(bcsRegistry),
      registerAlias: bcsRegistry.registerAlias.bind(bcsRegistry),
      registerBcsType: bcsRegistry.registerBcsType.bind(bcsRegistry),
      registerEnumType: bcsRegistry.registerEnumType.bind(bcsRegistry),
      registerStructType: bcsRegistry.registerStructType.bind(bcsRegistry),
      registerType: bcsRegistry.registerType.bind(bcsRegistry),
      types: bcsRegistry.types
    };
    bcsRegistry.registerBcsType("utf8string", () => bcs.string({ name: "utf8string" }));
    bcsRegistry.registerBcsType("unsafe_u64", () => unsafe_u64());
    bcsRegistry.registerBcsType("enumKind", (T) => enumKind(T));
    [
      Address,
      Argument,
      CallArg,
      CompressedSignature,
      GasData,
      MultiSig,
      MultiSigPkMap,
      MultiSigPublicKey,
      ObjectArg$1,
      ObjectDigest,
      ProgrammableMoveCall,
      ProgrammableTransaction,
      PublicKey$1,
      SenderSignedData,
      SharedObjectRef,
      StructTag,
      SuiObjectRef$1,
      Transaction,
      TransactionData,
      TransactionDataV1,
      TransactionExpiration$1,
      TransactionKind,
      TypeTag
    ].forEach((type) => {
      bcsRegistry.registerBcsType(type.name, () => type);
    });

    function bytesEqual(a, b) {
      if (a === b)
        return true;
      if (a.length !== b.length) {
        return false;
      }
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
          return false;
        }
      }
      return true;
    }
    class PublicKey {
      /**
       * Checks if two public keys are equal
       */
      equals(publicKey) {
        return bytesEqual(this.toRawBytes(), publicKey.toRawBytes());
      }
      /**
       * Return the base-64 representation of the public key
       */
      toBase64() {
        return toB64(this.toRawBytes());
      }
      toString() {
        throw new Error(
          "`toString` is not implemented on public keys. Use `toBase64()` or `toRawBytes()` instead."
        );
      }
      /**
       * Return the Sui representation of the public key encoded in
       * base-64. A Sui public key is formed by the concatenation
       * of the scheme flag with the raw bytes of the public key
       */
      toSuiPublicKey() {
        const bytes = this.toSuiBytes();
        return toB64(bytes);
      }
      verifyWithIntent(bytes, signature, intent) {
        const intentMessage = messageWithIntent(intent, bytes);
        const digest = blake2b(intentMessage, { dkLen: 32 });
        return this.verify(digest, signature);
      }
      /**
       * Verifies that the signature is valid for for the provided PersonalMessage
       */
      verifyPersonalMessage(message, signature) {
        return this.verifyWithIntent(
          suiBcs.vector(suiBcs.u8()).serialize(message).toBytes(),
          signature,
          IntentScope$1.PersonalMessage
        );
      }
      /**
       * Verifies that the signature is valid for for the provided TransactionBlock
       */
      verifyTransactionBlock(transactionBlock, signature) {
        return this.verifyWithIntent(transactionBlock, signature, IntentScope$1.TransactionData);
      }
      /**
       * Returns the bytes representation of the public key
       * prefixed with the signature scheme flag
       */
      toSuiBytes() {
        const rawBytes = this.toRawBytes();
        const suiBytes = new Uint8Array(rawBytes.length + 1);
        suiBytes.set([this.flag()]);
        suiBytes.set(rawBytes, 1);
        return suiBytes;
      }
      /**
       * Return the Sui address associated with this Ed25519 public key
       */
      toSuiAddress() {
        return normalizeSuiAddress(
          bytesToHex(blake2b(this.toSuiBytes(), { dkLen: 32 })).slice(0, SUI_ADDRESS_LENGTH * 2)
        );
      }
    }

    function devAssert(condition, message) {
      const booleanCondition = Boolean(condition);

      if (!booleanCondition) {
        throw new Error(message);
      }
    }

    /**
     * Contains a range of UTF-8 character offsets and token references that
     * identify the region of the source from which the AST derived.
     */
    /**
     * The list of all possible AST node types.
     */

    /**
     * @internal
     */
    const QueryDocumentKeys = {
      Name: [],
      Document: ['definitions'],
      OperationDefinition: [
        'name',
        'variableDefinitions',
        'directives',
        'selectionSet',
      ],
      VariableDefinition: ['variable', 'type', 'defaultValue', 'directives'],
      Variable: ['name'],
      SelectionSet: ['selections'],
      Field: ['alias', 'name', 'arguments', 'directives', 'selectionSet'],
      Argument: ['name', 'value'],
      FragmentSpread: ['name', 'directives'],
      InlineFragment: ['typeCondition', 'directives', 'selectionSet'],
      FragmentDefinition: [
        'name', // Note: fragment variable definitions are deprecated and will removed in v17.0.0
        'variableDefinitions',
        'typeCondition',
        'directives',
        'selectionSet',
      ],
      IntValue: [],
      FloatValue: [],
      StringValue: [],
      BooleanValue: [],
      NullValue: [],
      EnumValue: [],
      ListValue: ['values'],
      ObjectValue: ['fields'],
      ObjectField: ['name', 'value'],
      Directive: ['name', 'arguments'],
      NamedType: ['name'],
      ListType: ['type'],
      NonNullType: ['type'],
      SchemaDefinition: ['description', 'directives', 'operationTypes'],
      OperationTypeDefinition: ['type'],
      ScalarTypeDefinition: ['description', 'name', 'directives'],
      ObjectTypeDefinition: [
        'description',
        'name',
        'interfaces',
        'directives',
        'fields',
      ],
      FieldDefinition: ['description', 'name', 'arguments', 'type', 'directives'],
      InputValueDefinition: [
        'description',
        'name',
        'type',
        'defaultValue',
        'directives',
      ],
      InterfaceTypeDefinition: [
        'description',
        'name',
        'interfaces',
        'directives',
        'fields',
      ],
      UnionTypeDefinition: ['description', 'name', 'directives', 'types'],
      EnumTypeDefinition: ['description', 'name', 'directives', 'values'],
      EnumValueDefinition: ['description', 'name', 'directives'],
      InputObjectTypeDefinition: ['description', 'name', 'directives', 'fields'],
      DirectiveDefinition: ['description', 'name', 'arguments', 'locations'],
      SchemaExtension: ['directives', 'operationTypes'],
      ScalarTypeExtension: ['name', 'directives'],
      ObjectTypeExtension: ['name', 'interfaces', 'directives', 'fields'],
      InterfaceTypeExtension: ['name', 'interfaces', 'directives', 'fields'],
      UnionTypeExtension: ['name', 'directives', 'types'],
      EnumTypeExtension: ['name', 'directives', 'values'],
      InputObjectTypeExtension: ['name', 'directives', 'fields'],
    };
    const kindValues = new Set(Object.keys(QueryDocumentKeys));
    /**
     * @internal
     */

    function isNode(maybeNode) {
      const maybeKind =
        maybeNode === null || maybeNode === void 0 ? void 0 : maybeNode.kind;
      return typeof maybeKind === 'string' && kindValues.has(maybeKind);
    }
    /** Name */

    var OperationTypeNode;

    (function (OperationTypeNode) {
      OperationTypeNode['QUERY'] = 'query';
      OperationTypeNode['MUTATION'] = 'mutation';
      OperationTypeNode['SUBSCRIPTION'] = 'subscription';
    })(OperationTypeNode || (OperationTypeNode = {}));

    /**
     * The set of allowed kind values for AST nodes.
     */
    var Kind;

    (function (Kind) {
      Kind['NAME'] = 'Name';
      Kind['DOCUMENT'] = 'Document';
      Kind['OPERATION_DEFINITION'] = 'OperationDefinition';
      Kind['VARIABLE_DEFINITION'] = 'VariableDefinition';
      Kind['SELECTION_SET'] = 'SelectionSet';
      Kind['FIELD'] = 'Field';
      Kind['ARGUMENT'] = 'Argument';
      Kind['FRAGMENT_SPREAD'] = 'FragmentSpread';
      Kind['INLINE_FRAGMENT'] = 'InlineFragment';
      Kind['FRAGMENT_DEFINITION'] = 'FragmentDefinition';
      Kind['VARIABLE'] = 'Variable';
      Kind['INT'] = 'IntValue';
      Kind['FLOAT'] = 'FloatValue';
      Kind['STRING'] = 'StringValue';
      Kind['BOOLEAN'] = 'BooleanValue';
      Kind['NULL'] = 'NullValue';
      Kind['ENUM'] = 'EnumValue';
      Kind['LIST'] = 'ListValue';
      Kind['OBJECT'] = 'ObjectValue';
      Kind['OBJECT_FIELD'] = 'ObjectField';
      Kind['DIRECTIVE'] = 'Directive';
      Kind['NAMED_TYPE'] = 'NamedType';
      Kind['LIST_TYPE'] = 'ListType';
      Kind['NON_NULL_TYPE'] = 'NonNullType';
      Kind['SCHEMA_DEFINITION'] = 'SchemaDefinition';
      Kind['OPERATION_TYPE_DEFINITION'] = 'OperationTypeDefinition';
      Kind['SCALAR_TYPE_DEFINITION'] = 'ScalarTypeDefinition';
      Kind['OBJECT_TYPE_DEFINITION'] = 'ObjectTypeDefinition';
      Kind['FIELD_DEFINITION'] = 'FieldDefinition';
      Kind['INPUT_VALUE_DEFINITION'] = 'InputValueDefinition';
      Kind['INTERFACE_TYPE_DEFINITION'] = 'InterfaceTypeDefinition';
      Kind['UNION_TYPE_DEFINITION'] = 'UnionTypeDefinition';
      Kind['ENUM_TYPE_DEFINITION'] = 'EnumTypeDefinition';
      Kind['ENUM_VALUE_DEFINITION'] = 'EnumValueDefinition';
      Kind['INPUT_OBJECT_TYPE_DEFINITION'] = 'InputObjectTypeDefinition';
      Kind['DIRECTIVE_DEFINITION'] = 'DirectiveDefinition';
      Kind['SCHEMA_EXTENSION'] = 'SchemaExtension';
      Kind['SCALAR_TYPE_EXTENSION'] = 'ScalarTypeExtension';
      Kind['OBJECT_TYPE_EXTENSION'] = 'ObjectTypeExtension';
      Kind['INTERFACE_TYPE_EXTENSION'] = 'InterfaceTypeExtension';
      Kind['UNION_TYPE_EXTENSION'] = 'UnionTypeExtension';
      Kind['ENUM_TYPE_EXTENSION'] = 'EnumTypeExtension';
      Kind['INPUT_OBJECT_TYPE_EXTENSION'] = 'InputObjectTypeExtension';
    })(Kind || (Kind = {}));
    /**
     * The enum type representing the possible kind values of AST nodes.
     *
     * @deprecated Please use `Kind`. Will be remove in v17.
     */

    /**
     * ```
     * WhiteSpace ::
     *   - "Horizontal Tab (U+0009)"
     *   - "Space (U+0020)"
     * ```
     * @internal
     */
    function isWhiteSpace(code) {
      return code === 0x0009 || code === 0x0020;
    }

    /**
     * Print a block string in the indented block form by adding a leading and
     * trailing blank line. However, if a block string starts with whitespace and is
     * a single-line, adding a leading blank line would strip that whitespace.
     *
     * @internal
     */

    function printBlockString(value, options) {
      const escapedValue = value.replace(/"""/g, '\\"""'); // Expand a block string's raw value into independent lines.

      const lines = escapedValue.split(/\r\n|[\n\r]/g);
      const isSingleLine = lines.length === 1; // If common indentation is found we can fix some of those cases by adding leading new line

      const forceLeadingNewLine =
        lines.length > 1 &&
        lines
          .slice(1)
          .every((line) => line.length === 0 || isWhiteSpace(line.charCodeAt(0))); // Trailing triple quotes just looks confusing but doesn't force trailing new line

      const hasTrailingTripleQuotes = escapedValue.endsWith('\\"""'); // Trailing quote (single or double) or slash forces trailing new line

      const hasTrailingQuote = value.endsWith('"') && !hasTrailingTripleQuotes;
      const hasTrailingSlash = value.endsWith('\\');
      const forceTrailingNewline = hasTrailingQuote || hasTrailingSlash;
      const printAsMultipleLines =
        !(options !== null && options !== void 0 && options.minimize) && // add leading and trailing new lines only if it improves readability
        (!isSingleLine ||
          value.length > 70 ||
          forceTrailingNewline ||
          forceLeadingNewLine ||
          hasTrailingTripleQuotes);
      let result = ''; // Format a multi-line block quote to account for leading space.

      const skipLeadingNewLine = isSingleLine && isWhiteSpace(value.charCodeAt(0));

      if ((printAsMultipleLines && !skipLeadingNewLine) || forceLeadingNewLine) {
        result += '\n';
      }

      result += escapedValue;

      if (printAsMultipleLines || forceTrailingNewline) {
        result += '\n';
      }

      return '"""' + result + '"""';
    }

    const MAX_ARRAY_LENGTH = 10;
    const MAX_RECURSIVE_DEPTH = 2;
    /**
     * Used to print values in error messages.
     */

    function inspect(value) {
      return formatValue(value, []);
    }

    function formatValue(value, seenValues) {
      switch (typeof value) {
        case 'string':
          return JSON.stringify(value);

        case 'function':
          return value.name ? `[function ${value.name}]` : '[function]';

        case 'object':
          return formatObjectValue(value, seenValues);

        default:
          return String(value);
      }
    }

    function formatObjectValue(value, previouslySeenValues) {
      if (value === null) {
        return 'null';
      }

      if (previouslySeenValues.includes(value)) {
        return '[Circular]';
      }

      const seenValues = [...previouslySeenValues, value];

      if (isJSONable(value)) {
        const jsonValue = value.toJSON(); // check for infinite recursion

        if (jsonValue !== value) {
          return typeof jsonValue === 'string'
            ? jsonValue
            : formatValue(jsonValue, seenValues);
        }
      } else if (Array.isArray(value)) {
        return formatArray(value, seenValues);
      }

      return formatObject(value, seenValues);
    }

    function isJSONable(value) {
      return typeof value.toJSON === 'function';
    }

    function formatObject(object, seenValues) {
      const entries = Object.entries(object);

      if (entries.length === 0) {
        return '{}';
      }

      if (seenValues.length > MAX_RECURSIVE_DEPTH) {
        return '[' + getObjectTag(object) + ']';
      }

      const properties = entries.map(
        ([key, value]) => key + ': ' + formatValue(value, seenValues),
      );
      return '{ ' + properties.join(', ') + ' }';
    }

    function formatArray(array, seenValues) {
      if (array.length === 0) {
        return '[]';
      }

      if (seenValues.length > MAX_RECURSIVE_DEPTH) {
        return '[Array]';
      }

      const len = Math.min(MAX_ARRAY_LENGTH, array.length);
      const remaining = array.length - len;
      const items = [];

      for (let i = 0; i < len; ++i) {
        items.push(formatValue(array[i], seenValues));
      }

      if (remaining === 1) {
        items.push('... 1 more item');
      } else if (remaining > 1) {
        items.push(`... ${remaining} more items`);
      }

      return '[' + items.join(', ') + ']';
    }

    function getObjectTag(object) {
      const tag = Object.prototype.toString
        .call(object)
        .replace(/^\[object /, '')
        .replace(/]$/, '');

      if (tag === 'Object' && typeof object.constructor === 'function') {
        const name = object.constructor.name;

        if (typeof name === 'string' && name !== '') {
          return name;
        }
      }

      return tag;
    }

    /**
     * Prints a string as a GraphQL StringValue literal. Replaces control characters
     * and excluded characters (" U+0022 and \\ U+005C) with escape sequences.
     */
    function printString(str) {
      return `"${str.replace(escapedRegExp, escapedReplacer)}"`;
    } // eslint-disable-next-line no-control-regex

    const escapedRegExp = /[\x00-\x1f\x22\x5c\x7f-\x9f]/g;

    function escapedReplacer(str) {
      return escapeSequences[str.charCodeAt(0)];
    } // prettier-ignore

    const escapeSequences = [
      '\\u0000',
      '\\u0001',
      '\\u0002',
      '\\u0003',
      '\\u0004',
      '\\u0005',
      '\\u0006',
      '\\u0007',
      '\\b',
      '\\t',
      '\\n',
      '\\u000B',
      '\\f',
      '\\r',
      '\\u000E',
      '\\u000F',
      '\\u0010',
      '\\u0011',
      '\\u0012',
      '\\u0013',
      '\\u0014',
      '\\u0015',
      '\\u0016',
      '\\u0017',
      '\\u0018',
      '\\u0019',
      '\\u001A',
      '\\u001B',
      '\\u001C',
      '\\u001D',
      '\\u001E',
      '\\u001F',
      '',
      '',
      '\\"',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '', // 2F
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '', // 3F
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '', // 4F
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '\\\\',
      '',
      '',
      '', // 5F
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '', // 6F
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '\\u007F',
      '\\u0080',
      '\\u0081',
      '\\u0082',
      '\\u0083',
      '\\u0084',
      '\\u0085',
      '\\u0086',
      '\\u0087',
      '\\u0088',
      '\\u0089',
      '\\u008A',
      '\\u008B',
      '\\u008C',
      '\\u008D',
      '\\u008E',
      '\\u008F',
      '\\u0090',
      '\\u0091',
      '\\u0092',
      '\\u0093',
      '\\u0094',
      '\\u0095',
      '\\u0096',
      '\\u0097',
      '\\u0098',
      '\\u0099',
      '\\u009A',
      '\\u009B',
      '\\u009C',
      '\\u009D',
      '\\u009E',
      '\\u009F',
    ];

    /**
     * A visitor is provided to visit, it contains the collection of
     * relevant functions to be called during the visitor's traversal.
     */

    const BREAK = Object.freeze({});
    /**
     * visit() will walk through an AST using a depth-first traversal, calling
     * the visitor's enter function at each node in the traversal, and calling the
     * leave function after visiting that node and all of its child nodes.
     *
     * By returning different values from the enter and leave functions, the
     * behavior of the visitor can be altered, including skipping over a sub-tree of
     * the AST (by returning false), editing the AST by returning a value or null
     * to remove the value, or to stop the whole traversal by returning BREAK.
     *
     * When using visit() to edit an AST, the original AST will not be modified, and
     * a new version of the AST with the changes applied will be returned from the
     * visit function.
     *
     * ```ts
     * const editedAST = visit(ast, {
     *   enter(node, key, parent, path, ancestors) {
     *     // @return
     *     //   undefined: no action
     *     //   false: skip visiting this node
     *     //   visitor.BREAK: stop visiting altogether
     *     //   null: delete this node
     *     //   any value: replace this node with the returned value
     *   },
     *   leave(node, key, parent, path, ancestors) {
     *     // @return
     *     //   undefined: no action
     *     //   false: no action
     *     //   visitor.BREAK: stop visiting altogether
     *     //   null: delete this node
     *     //   any value: replace this node with the returned value
     *   }
     * });
     * ```
     *
     * Alternatively to providing enter() and leave() functions, a visitor can
     * instead provide functions named the same as the kinds of AST nodes, or
     * enter/leave visitors at a named key, leading to three permutations of the
     * visitor API:
     *
     * 1) Named visitors triggered when entering a node of a specific kind.
     *
     * ```ts
     * visit(ast, {
     *   Kind(node) {
     *     // enter the "Kind" node
     *   }
     * })
     * ```
     *
     * 2) Named visitors that trigger upon entering and leaving a node of a specific kind.
     *
     * ```ts
     * visit(ast, {
     *   Kind: {
     *     enter(node) {
     *       // enter the "Kind" node
     *     }
     *     leave(node) {
     *       // leave the "Kind" node
     *     }
     *   }
     * })
     * ```
     *
     * 3) Generic visitors that trigger upon entering and leaving any node.
     *
     * ```ts
     * visit(ast, {
     *   enter(node) {
     *     // enter any node
     *   },
     *   leave(node) {
     *     // leave any node
     *   }
     * })
     * ```
     */

    function visit(root, visitor, visitorKeys = QueryDocumentKeys) {
      const enterLeaveMap = new Map();

      for (const kind of Object.values(Kind)) {
        enterLeaveMap.set(kind, getEnterLeaveForKind(visitor, kind));
      }
      /* eslint-disable no-undef-init */

      let stack = undefined;
      let inArray = Array.isArray(root);
      let keys = [root];
      let index = -1;
      let edits = [];
      let node = root;
      let key = undefined;
      let parent = undefined;
      const path = [];
      const ancestors = [];
      /* eslint-enable no-undef-init */

      do {
        index++;
        const isLeaving = index === keys.length;
        const isEdited = isLeaving && edits.length !== 0;

        if (isLeaving) {
          key = ancestors.length === 0 ? undefined : path[path.length - 1];
          node = parent;
          parent = ancestors.pop();

          if (isEdited) {
            if (inArray) {
              node = node.slice();
              let editOffset = 0;

              for (const [editKey, editValue] of edits) {
                const arrayKey = editKey - editOffset;

                if (editValue === null) {
                  node.splice(arrayKey, 1);
                  editOffset++;
                } else {
                  node[arrayKey] = editValue;
                }
              }
            } else {
              node = { ...node };

              for (const [editKey, editValue] of edits) {
                node[editKey] = editValue;
              }
            }
          }

          index = stack.index;
          keys = stack.keys;
          edits = stack.edits;
          inArray = stack.inArray;
          stack = stack.prev;
        } else if (parent) {
          key = inArray ? index : keys[index];
          node = parent[key];

          if (node === null || node === undefined) {
            continue;
          }

          path.push(key);
        }

        let result;

        if (!Array.isArray(node)) {
          var _enterLeaveMap$get, _enterLeaveMap$get2;

          isNode(node) || devAssert(false, `Invalid AST Node: ${inspect(node)}.`);
          const visitFn = isLeaving
            ? (_enterLeaveMap$get = enterLeaveMap.get(node.kind)) === null ||
              _enterLeaveMap$get === void 0
              ? void 0
              : _enterLeaveMap$get.leave
            : (_enterLeaveMap$get2 = enterLeaveMap.get(node.kind)) === null ||
              _enterLeaveMap$get2 === void 0
            ? void 0
            : _enterLeaveMap$get2.enter;
          result =
            visitFn === null || visitFn === void 0
              ? void 0
              : visitFn.call(visitor, node, key, parent, path, ancestors);

          if (result === BREAK) {
            break;
          }

          if (result === false) {
            if (!isLeaving) {
              path.pop();
              continue;
            }
          } else if (result !== undefined) {
            edits.push([key, result]);

            if (!isLeaving) {
              if (isNode(result)) {
                node = result;
              } else {
                path.pop();
                continue;
              }
            }
          }
        }

        if (result === undefined && isEdited) {
          edits.push([key, node]);
        }

        if (isLeaving) {
          path.pop();
        } else {
          var _node$kind;

          stack = {
            inArray,
            index,
            keys,
            edits,
            prev: stack,
          };
          inArray = Array.isArray(node);
          keys = inArray
            ? node
            : (_node$kind = visitorKeys[node.kind]) !== null &&
              _node$kind !== void 0
            ? _node$kind
            : [];
          index = -1;
          edits = [];

          if (parent) {
            ancestors.push(parent);
          }

          parent = node;
        }
      } while (stack !== undefined);

      if (edits.length !== 0) {
        // New root
        return edits[edits.length - 1][1];
      }

      return root;
    }
    /**
     * Given a visitor instance and a node kind, return EnterLeaveVisitor for that kind.
     */

    function getEnterLeaveForKind(visitor, kind) {
      const kindVisitor = visitor[kind];

      if (typeof kindVisitor === 'object') {
        // { Kind: { enter() {}, leave() {} } }
        return kindVisitor;
      } else if (typeof kindVisitor === 'function') {
        // { Kind() {} }
        return {
          enter: kindVisitor,
          leave: undefined,
        };
      } // { enter() {}, leave() {} }

      return {
        enter: visitor.enter,
        leave: visitor.leave,
      };
    }

    /**
     * Converts an AST into a string, using one set of reasonable
     * formatting rules.
     */

    function print$1(ast) {
      return visit(ast, printDocASTReducer);
    }
    const MAX_LINE_LENGTH = 80;
    const printDocASTReducer = {
      Name: {
        leave: (node) => node.value,
      },
      Variable: {
        leave: (node) => '$' + node.name,
      },
      // Document
      Document: {
        leave: (node) => join(node.definitions, '\n\n'),
      },
      OperationDefinition: {
        leave(node) {
          const varDefs = wrap('(', join(node.variableDefinitions, ', '), ')');
          const prefix = join(
            [
              node.operation,
              join([node.name, varDefs]),
              join(node.directives, ' '),
            ],
            ' ',
          ); // Anonymous queries with no directives or variable definitions can use
          // the query short form.

          return (prefix === 'query' ? '' : prefix + ' ') + node.selectionSet;
        },
      },
      VariableDefinition: {
        leave: ({ variable, type, defaultValue, directives }) =>
          variable +
          ': ' +
          type +
          wrap(' = ', defaultValue) +
          wrap(' ', join(directives, ' ')),
      },
      SelectionSet: {
        leave: ({ selections }) => block(selections),
      },
      Field: {
        leave({ alias, name, arguments: args, directives, selectionSet }) {
          const prefix = wrap('', alias, ': ') + name;
          let argsLine = prefix + wrap('(', join(args, ', '), ')');

          if (argsLine.length > MAX_LINE_LENGTH) {
            argsLine = prefix + wrap('(\n', indent(join(args, '\n')), '\n)');
          }

          return join([argsLine, join(directives, ' '), selectionSet], ' ');
        },
      },
      Argument: {
        leave: ({ name, value }) => name + ': ' + value,
      },
      // Fragments
      FragmentSpread: {
        leave: ({ name, directives }) =>
          '...' + name + wrap(' ', join(directives, ' ')),
      },
      InlineFragment: {
        leave: ({ typeCondition, directives, selectionSet }) =>
          join(
            [
              '...',
              wrap('on ', typeCondition),
              join(directives, ' '),
              selectionSet,
            ],
            ' ',
          ),
      },
      FragmentDefinition: {
        leave: (
          { name, typeCondition, variableDefinitions, directives, selectionSet }, // Note: fragment variable definitions are experimental and may be changed
        ) =>
          // or removed in the future.
          `fragment ${name}${wrap('(', join(variableDefinitions, ', '), ')')} ` +
          `on ${typeCondition} ${wrap('', join(directives, ' '), ' ')}` +
          selectionSet,
      },
      // Value
      IntValue: {
        leave: ({ value }) => value,
      },
      FloatValue: {
        leave: ({ value }) => value,
      },
      StringValue: {
        leave: ({ value, block: isBlockString }) =>
          isBlockString ? printBlockString(value) : printString(value),
      },
      BooleanValue: {
        leave: ({ value }) => (value ? 'true' : 'false'),
      },
      NullValue: {
        leave: () => 'null',
      },
      EnumValue: {
        leave: ({ value }) => value,
      },
      ListValue: {
        leave: ({ values }) => '[' + join(values, ', ') + ']',
      },
      ObjectValue: {
        leave: ({ fields }) => '{' + join(fields, ', ') + '}',
      },
      ObjectField: {
        leave: ({ name, value }) => name + ': ' + value,
      },
      // Directive
      Directive: {
        leave: ({ name, arguments: args }) =>
          '@' + name + wrap('(', join(args, ', '), ')'),
      },
      // Type
      NamedType: {
        leave: ({ name }) => name,
      },
      ListType: {
        leave: ({ type }) => '[' + type + ']',
      },
      NonNullType: {
        leave: ({ type }) => type + '!',
      },
      // Type System Definitions
      SchemaDefinition: {
        leave: ({ description, directives, operationTypes }) =>
          wrap('', description, '\n') +
          join(['schema', join(directives, ' '), block(operationTypes)], ' '),
      },
      OperationTypeDefinition: {
        leave: ({ operation, type }) => operation + ': ' + type,
      },
      ScalarTypeDefinition: {
        leave: ({ description, name, directives }) =>
          wrap('', description, '\n') +
          join(['scalar', name, join(directives, ' ')], ' '),
      },
      ObjectTypeDefinition: {
        leave: ({ description, name, interfaces, directives, fields }) =>
          wrap('', description, '\n') +
          join(
            [
              'type',
              name,
              wrap('implements ', join(interfaces, ' & ')),
              join(directives, ' '),
              block(fields),
            ],
            ' ',
          ),
      },
      FieldDefinition: {
        leave: ({ description, name, arguments: args, type, directives }) =>
          wrap('', description, '\n') +
          name +
          (hasMultilineItems(args)
            ? wrap('(\n', indent(join(args, '\n')), '\n)')
            : wrap('(', join(args, ', '), ')')) +
          ': ' +
          type +
          wrap(' ', join(directives, ' ')),
      },
      InputValueDefinition: {
        leave: ({ description, name, type, defaultValue, directives }) =>
          wrap('', description, '\n') +
          join(
            [name + ': ' + type, wrap('= ', defaultValue), join(directives, ' ')],
            ' ',
          ),
      },
      InterfaceTypeDefinition: {
        leave: ({ description, name, interfaces, directives, fields }) =>
          wrap('', description, '\n') +
          join(
            [
              'interface',
              name,
              wrap('implements ', join(interfaces, ' & ')),
              join(directives, ' '),
              block(fields),
            ],
            ' ',
          ),
      },
      UnionTypeDefinition: {
        leave: ({ description, name, directives, types }) =>
          wrap('', description, '\n') +
          join(
            ['union', name, join(directives, ' '), wrap('= ', join(types, ' | '))],
            ' ',
          ),
      },
      EnumTypeDefinition: {
        leave: ({ description, name, directives, values }) =>
          wrap('', description, '\n') +
          join(['enum', name, join(directives, ' '), block(values)], ' '),
      },
      EnumValueDefinition: {
        leave: ({ description, name, directives }) =>
          wrap('', description, '\n') + join([name, join(directives, ' ')], ' '),
      },
      InputObjectTypeDefinition: {
        leave: ({ description, name, directives, fields }) =>
          wrap('', description, '\n') +
          join(['input', name, join(directives, ' '), block(fields)], ' '),
      },
      DirectiveDefinition: {
        leave: ({ description, name, arguments: args, repeatable, locations }) =>
          wrap('', description, '\n') +
          'directive @' +
          name +
          (hasMultilineItems(args)
            ? wrap('(\n', indent(join(args, '\n')), '\n)')
            : wrap('(', join(args, ', '), ')')) +
          (repeatable ? ' repeatable' : '') +
          ' on ' +
          join(locations, ' | '),
      },
      SchemaExtension: {
        leave: ({ directives, operationTypes }) =>
          join(
            ['extend schema', join(directives, ' '), block(operationTypes)],
            ' ',
          ),
      },
      ScalarTypeExtension: {
        leave: ({ name, directives }) =>
          join(['extend scalar', name, join(directives, ' ')], ' '),
      },
      ObjectTypeExtension: {
        leave: ({ name, interfaces, directives, fields }) =>
          join(
            [
              'extend type',
              name,
              wrap('implements ', join(interfaces, ' & ')),
              join(directives, ' '),
              block(fields),
            ],
            ' ',
          ),
      },
      InterfaceTypeExtension: {
        leave: ({ name, interfaces, directives, fields }) =>
          join(
            [
              'extend interface',
              name,
              wrap('implements ', join(interfaces, ' & ')),
              join(directives, ' '),
              block(fields),
            ],
            ' ',
          ),
      },
      UnionTypeExtension: {
        leave: ({ name, directives, types }) =>
          join(
            [
              'extend union',
              name,
              join(directives, ' '),
              wrap('= ', join(types, ' | ')),
            ],
            ' ',
          ),
      },
      EnumTypeExtension: {
        leave: ({ name, directives, values }) =>
          join(['extend enum', name, join(directives, ' '), block(values)], ' '),
      },
      InputObjectTypeExtension: {
        leave: ({ name, directives, fields }) =>
          join(['extend input', name, join(directives, ' '), block(fields)], ' '),
      },
    };
    /**
     * Given maybeArray, print an empty string if it is null or empty, otherwise
     * print all items together separated by separator if provided
     */

    function join(maybeArray, separator = '') {
      var _maybeArray$filter$jo;

      return (_maybeArray$filter$jo =
        maybeArray === null || maybeArray === void 0
          ? void 0
          : maybeArray.filter((x) => x).join(separator)) !== null &&
        _maybeArray$filter$jo !== void 0
        ? _maybeArray$filter$jo
        : '';
    }
    /**
     * Given array, print each item on its own line, wrapped in an indented `{ }` block.
     */

    function block(array) {
      return wrap('{\n', indent(join(array, '\n')), '\n}');
    }
    /**
     * If maybeString is not null or empty, then wrap with start and end, otherwise print an empty string.
     */

    function wrap(start, maybeString, end = '') {
      return maybeString != null && maybeString !== ''
        ? start + maybeString + end
        : '';
    }

    function indent(str) {
      return wrap('  ', str.replace(/\n/g, '\n  '));
    }

    function hasMultilineItems(maybeArray) {
      var _maybeArray$some;

      // FIXME: https://github.com/graphql/graphql-js/issues/2203

      /* c8 ignore next */
      return (_maybeArray$some =
        maybeArray === null || maybeArray === void 0
          ? void 0
          : maybeArray.some((str) => str.includes('\n'))) !== null &&
        _maybeArray$some !== void 0
        ? _maybeArray$some
        : false;
    }

    var __accessCheck$4 = (obj, member, msg) => {
      if (!member.has(obj))
        throw TypeError("Cannot " + msg);
    };
    var __privateGet$4 = (obj, member, getter) => {
      __accessCheck$4(obj, member, "read from private field");
      return getter ? getter.call(obj) : member.get(obj);
    };
    var __privateAdd$4 = (obj, member, value) => {
      if (member.has(obj))
        throw TypeError("Cannot add the same private member more than once");
      member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
    };
    var __privateSet$4 = (obj, member, value, setter) => {
      __accessCheck$4(obj, member, "write to private field");
      setter ? setter.call(obj, value) : member.set(obj, value);
      return value;
    };
    var _url, _queries, _headers, _fetch;
    class SuiGraphQLRequestError extends Error {
    }
    class SuiGraphQLClient {
      constructor({
        url,
        fetch: fetchFn = fetch,
        headers = {},
        queries = {}
      }) {
        __privateAdd$4(this, _url, void 0);
        __privateAdd$4(this, _queries, void 0);
        __privateAdd$4(this, _headers, void 0);
        __privateAdd$4(this, _fetch, void 0);
        __privateSet$4(this, _url, url);
        __privateSet$4(this, _queries, queries);
        __privateSet$4(this, _headers, headers);
        __privateSet$4(this, _fetch, (...args) => fetchFn(...args));
      }
      async query(options) {
        const res = await __privateGet$4(this, _fetch).call(this, __privateGet$4(this, _url), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...__privateGet$4(this, _headers)
          },
          body: JSON.stringify({
            query: typeof options.query === "string" ? String(options.query) : print$1(options.query),
            variables: options.variables,
            extensions: options.extensions,
            operationName: options.operationName
          })
        });
        if (!res.ok) {
          throw new SuiGraphQLRequestError(`GraphQL request failed: ${res.statusText} (${res.status})`);
        }
        return await res.json();
      }
      async execute(query, options) {
        return this.query({
          ...options,
          query: __privateGet$4(this, _queries)[query]
        });
      }
    }
    _url = new WeakMap();
    _queries = new WeakMap();
    _headers = new WeakMap();
    _fetch = new WeakMap();

    var e$1 = {
      NAME: "Name",
      DOCUMENT: "Document",
      OPERATION_DEFINITION: "OperationDefinition",
      VARIABLE_DEFINITION: "VariableDefinition",
      SELECTION_SET: "SelectionSet",
      FIELD: "Field",
      ARGUMENT: "Argument",
      FRAGMENT_SPREAD: "FragmentSpread",
      INLINE_FRAGMENT: "InlineFragment",
      FRAGMENT_DEFINITION: "FragmentDefinition",
      VARIABLE: "Variable",
      INT: "IntValue",
      FLOAT: "FloatValue",
      STRING: "StringValue",
      BOOLEAN: "BooleanValue",
      NULL: "NullValue",
      ENUM: "EnumValue",
      LIST: "ListValue",
      OBJECT: "ObjectValue",
      OBJECT_FIELD: "ObjectField",
      DIRECTIVE: "Directive",
      NAMED_TYPE: "NamedType",
      LIST_TYPE: "ListType",
      NON_NULL_TYPE: "NonNullType"
    };

    class GraphQLError extends Error {
      constructor(e, r, i, n, t, a, o) {
        if (super(e), this.name = "GraphQLError", this.message = e, t) {
          this.path = t;
        }
        if (r) {
          this.nodes = Array.isArray(r) ? r : [ r ];
        }
        if (i) {
          this.source = i;
        }
        if (n) {
          this.positions = n;
        }
        if (a) {
          this.originalError = a;
        }
        var l = o;
        if (!l && a) {
          var d = a.extensions;
          if (d && "object" == typeof d) {
            l = d;
          }
        }
        this.extensions = l || {};
      }
      toJSON() {
        return {
          ...this,
          message: this.message
        };
      }
      toString() {
        return this.message;
      }
      get [Symbol.toStringTag]() {
        return "GraphQLError";
      }
    }

    var i;

    var n;

    function error(e) {
      return new GraphQLError(`Syntax Error: Unexpected token at ${n} in ${e}`);
    }

    function advance(e) {
      if (e.lastIndex = n, e.test(i)) {
        return i.slice(n, n = e.lastIndex);
      }
    }

    var t = / +(?=[^\s])/y;

    function blockString(e) {
      var r = e.split("\n");
      var i = "";
      var n = 0;
      var a = 0;
      var o = r.length - 1;
      for (var l = 0; l < r.length; l++) {
        if (t.lastIndex = 0, t.test(r[l])) {
          if (l && (!n || t.lastIndex < n)) {
            n = t.lastIndex;
          }
          a = a || l, o = l;
        }
      }
      for (var d = a; d <= o; d++) {
        if (d !== a) {
          i += "\n";
        }
        i += r[d].slice(n).replace(/\\"""/g, '"""');
      }
      return i;
    }

    function ignored() {
      for (var e = 0 | i.charCodeAt(n++); 9 === e || 10 === e || 13 === e || 32 === e || 35 === e || 44 === e || 65279 === e; e = 0 | i.charCodeAt(n++)) {
        if (35 === e) {
          for (;(e = 0 | i.charCodeAt(n++)) && 10 !== e && 13 !== e; ) {}
        }
      }
      n--;
    }

    function name() {
      var e = n;
      for (var r = 0 | i.charCodeAt(n++); r >= 48 && r <= 57 || r >= 65 && r <= 90 || 95 === r || r >= 97 && r <= 122; r = 0 | i.charCodeAt(n++)) {}
      if (e === n - 1) {
        throw error("Name");
      }
      var t = i.slice(e, --n);
      return ignored(), t;
    }

    function nameNode() {
      return {
        kind: "Name",
        value: name()
      };
    }

    var a$1 = /(?:"""|(?:[\s\S]*?[^\\])""")/y;

    var o = /(?:(?:\.\d+)?[eE][+-]?\d+|\.\d+)/y;

    function value(e) {
      var r;
      switch (i.charCodeAt(n)) {
       case 91:
        n++, ignored();
        var t = [];
        for (;93 !== i.charCodeAt(n); ) {
          t.push(value(e));
        }
        return n++, ignored(), {
          kind: "ListValue",
          values: t
        };

       case 123:
        n++, ignored();
        var l = [];
        for (;125 !== i.charCodeAt(n); ) {
          var d = nameNode();
          if (58 !== i.charCodeAt(n++)) {
            throw error("ObjectField");
          }
          ignored(), l.push({
            kind: "ObjectField",
            name: d,
            value: value(e)
          });
        }
        return n++, ignored(), {
          kind: "ObjectValue",
          fields: l
        };

       case 36:
        if (e) {
          throw error("Variable");
        }
        return n++, {
          kind: "Variable",
          name: nameNode()
        };

       case 34:
        if (34 === i.charCodeAt(n + 1) && 34 === i.charCodeAt(n + 2)) {
          if (n += 3, null == (r = advance(a$1))) {
            throw error("StringValue");
          }
          return ignored(), {
            kind: "StringValue",
            value: blockString(r.slice(0, -3)),
            block: !0
          };
        } else {
          var u = n;
          var s;
          n++;
          var c = !1;
          for (s = 0 | i.charCodeAt(n++); 92 === s && (n++, c = !0) || 10 !== s && 13 !== s && 34 !== s && s; s = 0 | i.charCodeAt(n++)) {}
          if (34 !== s) {
            throw error("StringValue");
          }
          return r = i.slice(u, n), ignored(), {
            kind: "StringValue",
            value: c ? JSON.parse(r) : r.slice(1, -1),
            block: !1
          };
        }

       case 45:
       case 48:
       case 49:
       case 50:
       case 51:
       case 52:
       case 53:
       case 54:
       case 55:
       case 56:
       case 57:
        var v = n++;
        var f;
        for (;(f = 0 | i.charCodeAt(n++)) >= 48 && f <= 57; ) {}
        var m = i.slice(v, --n);
        if (46 === (f = i.charCodeAt(n)) || 69 === f || 101 === f) {
          if (null == (r = advance(o))) {
            throw error("FloatValue");
          }
          return ignored(), {
            kind: "FloatValue",
            value: m + r
          };
        } else {
          return ignored(), {
            kind: "IntValue",
            value: m
          };
        }

       case 110:
        if (117 === i.charCodeAt(n + 1) && 108 === i.charCodeAt(n + 2) && 108 === i.charCodeAt(n + 3)) {
          return n += 4, ignored(), {
            kind: "NullValue"
          };
        } else {
          break;
        }

       case 116:
        if (114 === i.charCodeAt(n + 1) && 117 === i.charCodeAt(n + 2) && 101 === i.charCodeAt(n + 3)) {
          return n += 4, ignored(), {
            kind: "BooleanValue",
            value: !0
          };
        } else {
          break;
        }

       case 102:
        if (97 === i.charCodeAt(n + 1) && 108 === i.charCodeAt(n + 2) && 115 === i.charCodeAt(n + 3) && 101 === i.charCodeAt(n + 4)) {
          return n += 5, ignored(), {
            kind: "BooleanValue",
            value: !1
          };
        } else {
          break;
        }
      }
      return {
        kind: "EnumValue",
        value: name()
      };
    }

    function arguments_(e) {
      if (40 === i.charCodeAt(n)) {
        var r = [];
        n++, ignored();
        do {
          var t = nameNode();
          if (58 !== i.charCodeAt(n++)) {
            throw error("Argument");
          }
          ignored(), r.push({
            kind: "Argument",
            name: t,
            value: value(e)
          });
        } while (41 !== i.charCodeAt(n));
        return n++, ignored(), r;
      }
    }

    function directives(e) {
      if (64 === i.charCodeAt(n)) {
        var r = [];
        do {
          n++, r.push({
            kind: "Directive",
            name: nameNode(),
            arguments: arguments_(e)
          });
        } while (64 === i.charCodeAt(n));
        return r;
      }
    }

    function type() {
      var e = 0;
      for (;91 === i.charCodeAt(n); ) {
        e++, n++, ignored();
      }
      var r = {
        kind: "NamedType",
        name: nameNode()
      };
      do {
        if (33 === i.charCodeAt(n)) {
          n++, ignored(), r = {
            kind: "NonNullType",
            type: r
          };
        }
        if (e) {
          if (93 !== i.charCodeAt(n++)) {
            throw error("NamedType");
          }
          ignored(), r = {
            kind: "ListType",
            type: r
          };
        }
      } while (e--);
      return r;
    }

    function selectionSetStart() {
      if (123 !== i.charCodeAt(n++)) {
        throw error("SelectionSet");
      }
      return ignored(), selectionSet();
    }

    function selectionSet() {
      var e = [];
      do {
        if (46 === i.charCodeAt(n)) {
          if (46 !== i.charCodeAt(++n) || 46 !== i.charCodeAt(++n)) {
            throw error("SelectionSet");
          }
          switch (n++, ignored(), i.charCodeAt(n)) {
           case 64:
            e.push({
              kind: "InlineFragment",
              typeCondition: void 0,
              directives: directives(!1),
              selectionSet: selectionSetStart()
            });
            break;

           case 111:
            if (110 === i.charCodeAt(n + 1)) {
              n += 2, ignored(), e.push({
                kind: "InlineFragment",
                typeCondition: {
                  kind: "NamedType",
                  name: nameNode()
                },
                directives: directives(!1),
                selectionSet: selectionSetStart()
              });
            } else {
              e.push({
                kind: "FragmentSpread",
                name: nameNode(),
                directives: directives(!1)
              });
            }
            break;

           case 123:
            n++, ignored(), e.push({
              kind: "InlineFragment",
              typeCondition: void 0,
              directives: void 0,
              selectionSet: selectionSet()
            });
            break;

           default:
            e.push({
              kind: "FragmentSpread",
              name: nameNode(),
              directives: directives(!1)
            });
          }
        } else {
          var r = nameNode();
          var t = void 0;
          if (58 === i.charCodeAt(n)) {
            n++, ignored(), t = r, r = nameNode();
          }
          var a = arguments_(!1);
          var o = directives(!1);
          var l = void 0;
          if (123 === i.charCodeAt(n)) {
            n++, ignored(), l = selectionSet();
          }
          e.push({
            kind: "Field",
            alias: t,
            name: r,
            arguments: a,
            directives: o,
            selectionSet: l
          });
        }
      } while (125 !== i.charCodeAt(n));
      return n++, ignored(), {
        kind: "SelectionSet",
        selections: e
      };
    }

    function variableDefinitions() {
      if (ignored(), 40 === i.charCodeAt(n)) {
        var e = [];
        n++, ignored();
        do {
          var r = void 0;
          if (34 === i.charCodeAt(n)) {
            r = value(!0);
          }
          if (36 !== i.charCodeAt(n++)) {
            throw error("Variable");
          }
          var t = nameNode();
          if (58 !== i.charCodeAt(n++)) {
            throw error("VariableDefinition");
          }
          ignored();
          var a = type();
          var o = void 0;
          if (61 === i.charCodeAt(n)) {
            n++, ignored(), o = value(!0);
          }
          ignored();
          var l = {
            kind: "VariableDefinition",
            variable: {
              kind: "Variable",
              name: t
            },
            type: a,
            defaultValue: o,
            directives: directives(!0)
          };
          if (r) {
            l.description = r;
          }
          e.push(l);
        } while (41 !== i.charCodeAt(n));
        return n++, ignored(), e;
      }
    }

    function fragmentDefinition(e) {
      var r = nameNode();
      if (111 !== i.charCodeAt(n++) || 110 !== i.charCodeAt(n++)) {
        throw error("FragmentDefinition");
      }
      ignored();
      var t = {
        kind: "FragmentDefinition",
        name: r,
        typeCondition: {
          kind: "NamedType",
          name: nameNode()
        },
        directives: directives(!1),
        selectionSet: selectionSetStart()
      };
      if (e) {
        t.description = e;
      }
      return t;
    }

    function definitions() {
      var e = [];
      do {
        var r = void 0;
        if (34 === i.charCodeAt(n)) {
          r = value(!0);
        }
        if (123 === i.charCodeAt(n)) {
          if (r) {
            throw error("Document");
          }
          n++, ignored(), e.push({
            kind: "OperationDefinition",
            operation: "query",
            name: void 0,
            variableDefinitions: void 0,
            directives: void 0,
            selectionSet: selectionSet()
          });
        } else {
          var t = name();
          switch (t) {
           case "fragment":
            e.push(fragmentDefinition(r));
            break;

           case "query":
           case "mutation":
           case "subscription":
            var a;
            var o = void 0;
            if (40 !== (a = i.charCodeAt(n)) && 64 !== a && 123 !== a) {
              o = nameNode();
            }
            var l = {
              kind: "OperationDefinition",
              operation: t,
              name: o,
              variableDefinitions: variableDefinitions(),
              directives: directives(!1),
              selectionSet: selectionSetStart()
            };
            if (r) {
              l.description = r;
            }
            e.push(l);
            break;

           default:
            throw error("Document");
          }
        }
      } while (n < i.length);
      return e;
    }

    function parse(e, r) {
      if (i = e.body ? e.body : e, n = 0, ignored(), r && r.noLocation) {
        return {
          kind: "Document",
          definitions: definitions()
        };
      } else {
        return {
          kind: "Document",
          definitions: definitions(),
          loc: {
            start: 0,
            end: i.length,
            startToken: void 0,
            endToken: void 0,
            source: {
              body: i,
              name: "graphql.web",
              locationOffset: {
                line: 1,
                column: 1
              }
            }
          }
        };
      }
    }

    var a = 0;

    var e = new Set;

    function initGraphQLTada() {
      function graphql(t, i) {
        var o = parse(t).definitions;
        var s = new Set;
        for (var f of i || []) {
          for (var u of f.definitions) {
            if (u.kind === e$1.FRAGMENT_DEFINITION && !s.has(u)) {
              o.push(u);
              s.add(u);
            }
          }
        }
        var d;
        if ((d = o[0].kind === e$1.FRAGMENT_DEFINITION) && o[0].directives) {
          o[0].directives = o[0].directives.filter((r => "_unmask" !== r.name.value));
        }
        var c;
        return {
          kind: e$1.DOCUMENT,
          definitions: o,
          get loc() {
            if (!c && d) {
              var r = t + function concatLocSources(r) {
                try {
                  a++;
                  var n = "";
                  for (var t of r) {
                    if (!e.has(t)) {
                      e.add(t);
                      var {loc: i} = t;
                      if (i) {
                        n += i.source.body;
                      }
                    }
                  }
                  return n;
                } finally {
                  if (0 == --a) {
                    e.clear();
                  }
                }
              }(i || []);
              return {
                start: 0,
                end: r.length,
                source: {
                  body: r,
                  name: "GraphQLTada",
                  locationOffset: {
                    line: 1,
                    column: 1
                  }
                }
              };
            }
            return c;
          },
          set loc(r) {
            c = r;
          }
        };
      }
      graphql.scalar = function scalar(r, n) {
        return n;
      };
      graphql.persisted = function persisted(n, a) {
        return {
          kind: e$1.DOCUMENT,
          definitions: a ? a.definitions : [],
          documentId: n
        };
      };
      return graphql;
    }

    initGraphQLTada();

    const graphql = initGraphQLTada();

    function base64UrlCharTo6Bits(base64UrlChar) {
      if (base64UrlChar.length !== 1) {
        throw new Error("Invalid base64Url character: " + base64UrlChar);
      }
      const base64UrlCharacterSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
      const index = base64UrlCharacterSet.indexOf(base64UrlChar);
      if (index === -1) {
        throw new Error("Invalid base64Url character: " + base64UrlChar);
      }
      const binaryString = index.toString(2).padStart(6, "0");
      const bits = Array.from(binaryString).map(Number);
      return bits;
    }
    function base64UrlStringToBitVector(base64UrlString) {
      let bitVector = [];
      for (let i = 0; i < base64UrlString.length; i++) {
        const base64UrlChar = base64UrlString.charAt(i);
        const bits = base64UrlCharTo6Bits(base64UrlChar);
        bitVector = bitVector.concat(bits);
      }
      return bitVector;
    }
    function decodeBase64URL(s, i) {
      if (s.length < 2) {
        throw new Error(`Input (s = ${s}) is not tightly packed because s.length < 2`);
      }
      let bits = base64UrlStringToBitVector(s);
      const firstCharOffset = i % 4;
      if (firstCharOffset === 0) ; else if (firstCharOffset === 1) {
        bits = bits.slice(2);
      } else if (firstCharOffset === 2) {
        bits = bits.slice(4);
      } else {
        throw new Error(`Input (s = ${s}) is not tightly packed because i%4 = 3 (i = ${i}))`);
      }
      const lastCharOffset = (i + s.length - 1) % 4;
      if (lastCharOffset === 3) ; else if (lastCharOffset === 2) {
        bits = bits.slice(0, bits.length - 2);
      } else if (lastCharOffset === 1) {
        bits = bits.slice(0, bits.length - 4);
      } else {
        throw new Error(
          `Input (s = ${s}) is not tightly packed because (i + s.length - 1)%4 = 0 (i = ${i}))`
        );
      }
      if (bits.length % 8 !== 0) {
        throw new Error(`We should never reach here...`);
      }
      const bytes = new Uint8Array(Math.floor(bits.length / 8));
      let currentByteIndex = 0;
      for (let i2 = 0; i2 < bits.length; i2 += 8) {
        const bitChunk = bits.slice(i2, i2 + 8);
        const byte = parseInt(bitChunk.join(""), 2);
        bytes[currentByteIndex++] = byte;
      }
      return new TextDecoder().decode(bytes);
    }
    function verifyExtendedClaim(claim) {
      if (!(claim.slice(-1) === "}" || claim.slice(-1) === ",")) {
        throw new Error("Invalid claim");
      }
      const json = JSON.parse("{" + claim.slice(0, -1) + "}");
      if (Object.keys(json).length !== 1) {
        throw new Error("Invalid claim");
      }
      const key = Object.keys(json)[0];
      return [key, json[key]];
    }
    function extractClaimValue(claim, claimName) {
      const extendedClaim = decodeBase64URL(claim.value, claim.indexMod4);
      const [name, value] = verifyExtendedClaim(extendedClaim);
      if (name !== claimName) {
        throw new Error(`Invalid field name: found ${name} expected ${claimName}`);
      }
      return value;
    }

    const zkLoginSignature = bcs.struct("ZkLoginSignature", {
      inputs: bcs.struct("ZkLoginSignatureInputs", {
        proofPoints: bcs.struct("ZkLoginSignatureInputsProofPoints", {
          a: bcs.vector(bcs.string()),
          b: bcs.vector(bcs.vector(bcs.string())),
          c: bcs.vector(bcs.string())
        }),
        issBase64Details: bcs.struct("ZkLoginSignatureInputsClaim", {
          value: bcs.string(),
          indexMod4: bcs.u8()
        }),
        headerBase64: bcs.string(),
        addressSeed: bcs.string()
      }),
      maxEpoch: bcs.u64(),
      userSignature: bcs.vector(bcs.u8())
    });

    function parseZkLoginSignature(signature) {
      return zkLoginSignature.parse(typeof signature === "string" ? fromB64(signature) : signature);
    }

    function toPaddedBigEndianBytes(num, width) {
      const hex = num.toString(16);
      return hexToBytes(hex.padStart(width * 2, "0").slice(-width * 2));
    }

    var __accessCheck$3 = (obj, member, msg) => {
      if (!member.has(obj))
        throw TypeError("Cannot " + msg);
    };
    var __privateGet$3 = (obj, member, getter) => {
      __accessCheck$3(obj, member, "read from private field");
      return getter ? getter.call(obj) : member.get(obj);
    };
    var __privateAdd$3 = (obj, member, value) => {
      if (member.has(obj))
        throw TypeError("Cannot add the same private member more than once");
      member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
    };
    var __privateSet$3 = (obj, member, value, setter) => {
      __accessCheck$3(obj, member, "write to private field");
      setter ? setter.call(obj, value) : member.set(obj, value);
      return value;
    };
    var _data, _client;
    class ZkLoginPublicIdentifier extends PublicKey {
      /**
       * Create a new ZkLoginPublicIdentifier object
       * @param value zkLogin public identifier as buffer or base-64 encoded string
       */
      constructor(value, { client } = {}) {
        super();
        __privateAdd$3(this, _data, void 0);
        __privateAdd$3(this, _client, void 0);
        __privateSet$3(this, _client, client);
        if (typeof value === "string") {
          __privateSet$3(this, _data, fromB64(value));
        } else if (value instanceof Uint8Array) {
          __privateSet$3(this, _data, value);
        } else {
          __privateSet$3(this, _data, Uint8Array.from(value));
        }
      }
      /**
       * Checks if two zkLogin public identifiers are equal
       */
      equals(publicKey) {
        return super.equals(publicKey);
      }
      /**
       * Return the byte array representation of the zkLogin public identifier
       */
      toRawBytes() {
        return __privateGet$3(this, _data);
      }
      /**
       * Return the Sui address associated with this ZkLogin public identifier
       */
      flag() {
        return SIGNATURE_SCHEME_TO_FLAG["ZkLogin"];
      }
      /**
       * Verifies that the signature is valid for for the provided message
       */
      async verify(_message, _signature) {
        throw Error("does not support");
      }
      /**
       * Verifies that the signature is valid for for the provided PersonalMessage
       */
      verifyPersonalMessage(message, signature) {
        const parsedSignature = parseSerializedZkLoginSignature(signature);
        return graphqlVerifyZkLoginSignature({
          address: parsedSignature.zkLogin.address,
          bytes: toB64(message),
          signature: parsedSignature.serializedSignature,
          intentScope: "PERSONAL_MESSAGE",
          client: __privateGet$3(this, _client)
        });
      }
      /**
       * Verifies that the signature is valid for for the provided TransactionBlock
       */
      verifyTransactionBlock(transactionBlock, signature) {
        const parsedSignature = parseSerializedZkLoginSignature(signature);
        return graphqlVerifyZkLoginSignature({
          address: parsedSignature.zkLogin.address,
          bytes: toB64(transactionBlock),
          signature: parsedSignature.serializedSignature,
          intentScope: "TRANSACTION_DATA",
          client: __privateGet$3(this, _client)
        });
      }
    }
    _data = new WeakMap();
    _client = new WeakMap();
    function toZkLoginPublicIdentifier(addressSeed, iss, options) {
      const addressSeedBytesBigEndian = toPaddedBigEndianBytes(addressSeed, 32);
      const issBytes = new TextEncoder().encode(iss);
      const tmp = new Uint8Array(1 + issBytes.length + addressSeedBytesBigEndian.length);
      tmp.set([issBytes.length], 0);
      tmp.set(issBytes, 1);
      tmp.set(addressSeedBytesBigEndian, 1 + issBytes.length);
      return new ZkLoginPublicIdentifier(tmp, options);
    }
    const VerifyZkLoginSignatureQuery = graphql(`
	query Zklogin(
		$bytes: Base64!
		$signature: Base64!
		$intentScope: ZkLoginIntentScope!
		$author: SuiAddress!
	) {
		verifyZkloginSignature(
			bytes: $bytes
			signature: $signature
			intentScope: $intentScope
			author: $author
		) {
			success
			errors
		}
	}
`);
    async function graphqlVerifyZkLoginSignature({
      address,
      bytes,
      signature,
      intentScope,
      client = new SuiGraphQLClient({
        url: "https://sui-mainnet.mystenlabs.com/graphql"
      })
    }) {
      const resp = await client.query({
        query: VerifyZkLoginSignatureQuery,
        variables: {
          bytes,
          signature,
          intentScope,
          author: address
        }
      });
      return resp.data?.verifyZkloginSignature.success === true && resp.data?.verifyZkloginSignature.errors.length === 0;
    }
    function parseSerializedZkLoginSignature(signature) {
      const bytes = typeof signature === "string" ? fromB64(signature) : signature;
      if (bytes[0] !== SIGNATURE_SCHEME_TO_FLAG.ZkLogin) {
        throw new Error("Invalid signature scheme");
      }
      const signatureBytes = bytes.slice(1);
      const { inputs, maxEpoch, userSignature } = parseZkLoginSignature(signatureBytes);
      const { issBase64Details, addressSeed } = inputs;
      const iss = extractClaimValue(issBase64Details, "iss");
      const publicIdentifer = toZkLoginPublicIdentifier(BigInt(addressSeed), iss);
      const address = publicIdentifer.toSuiAddress();
      return {
        serializedSignature: toB64(bytes),
        signatureScheme: "ZkLogin",
        zkLogin: {
          inputs,
          maxEpoch,
          userSignature,
          iss,
          address,
          addressSeed: BigInt(addressSeed)
        },
        signature: bytes,
        publicKey: publicIdentifer.toRawBytes()
      };
    }

    function toSerializedSignature({
      signature,
      signatureScheme,
      publicKey
    }) {
      if (!publicKey) {
        throw new Error("`publicKey` is required");
      }
      const pubKeyBytes = publicKey.toRawBytes();
      const serializedSignature = new Uint8Array(1 + signature.length + pubKeyBytes.length);
      serializedSignature.set([SIGNATURE_SCHEME_TO_FLAG[signatureScheme]]);
      serializedSignature.set(signature, 1);
      serializedSignature.set(pubKeyBytes, 1 + signature.length);
      return toB64(serializedSignature);
    }
    function parseSerializedSignature(serializedSignature) {
      const bytes = fromB64(serializedSignature);
      const signatureScheme = SIGNATURE_FLAG_TO_SCHEME[bytes[0]];
      switch (signatureScheme) {
        case "MultiSig":
          const multisig = suiBcs.MultiSig.parse(bytes.slice(1));
          return {
            serializedSignature,
            signatureScheme,
            multisig,
            bytes
          };
        case "ZkLogin":
          return parseSerializedZkLoginSignature(serializedSignature);
        case "ED25519":
        case "Secp256k1":
        case "Secp256r1":
          const size = SIGNATURE_SCHEME_TO_SIZE[signatureScheme];
          const signature = bytes.slice(1, bytes.length - size);
          const publicKey = bytes.slice(1 + signature.length);
          return {
            serializedSignature,
            signatureScheme,
            signature,
            publicKey,
            bytes
          };
        default:
          throw new Error("Unsupported signature scheme");
      }
    }

    const PRIVATE_KEY_SIZE = 32;
    const SUI_PRIVATE_KEY_PREFIX = "suiprivkey";
    class Signer {
      /**
       * Sign messages with a specific intent. By combining the message bytes with the intent before hashing and signing,
       * it ensures that a signed message is tied to a specific purpose and domain separator is provided
       */
      async signWithIntent(bytes, intent) {
        const intentMessage = messageWithIntent(intent, bytes);
        const digest = blake2b(intentMessage, { dkLen: 32 });
        const signature = toSerializedSignature({
          signature: await this.sign(digest),
          signatureScheme: this.getKeyScheme(),
          publicKey: this.getPublicKey()
        });
        return {
          signature,
          bytes: toB64(bytes)
        };
      }
      /**
       * Signs provided transaction block by calling `signWithIntent()` with a `TransactionData` provided as intent scope
       */
      async signTransactionBlock(bytes) {
        return this.signWithIntent(bytes, IntentScope$1.TransactionData);
      }
      /**
       * Signs provided personal message by calling `signWithIntent()` with a `PersonalMessage` provided as intent scope
       */
      async signPersonalMessage(bytes) {
        return this.signWithIntent(
          bcs.vector(bcs.u8()).serialize(bytes).toBytes(),
          IntentScope$1.PersonalMessage
        );
      }
      toSuiAddress() {
        return this.getPublicKey().toSuiAddress();
      }
    }
    class Keypair extends Signer {
      /**
       * @deprecated use {@link Keypair.getSecretKey} instead
       * This returns an exported keypair object, schema is the signature
       * scheme name, and the private key field is a Bech32 encoded string
       * of 33-byte `flag || private_key` that starts with `suiprivkey`.
       */
      export() {
        return {
          schema: this.getKeyScheme(),
          privateKey: this.getSecretKey()
        };
      }
    }
    function encodeSuiPrivateKey(bytes, scheme) {
      if (bytes.length !== PRIVATE_KEY_SIZE) {
        throw new Error("Invalid bytes length");
      }
      const flag = SIGNATURE_SCHEME_TO_FLAG[scheme];
      const privKeyBytes = new Uint8Array(bytes.length + 1);
      privKeyBytes.set([flag]);
      privKeyBytes.set(bytes, 1);
      return dist.bech32.encode(SUI_PRIVATE_KEY_PREFIX, dist.bech32.toWords(privKeyBytes));
    }

    /**
     * HMAC: RFC2104 message authentication code.
     * @module
     */
    class HMAC extends Hash {
        constructor(hash, _key) {
            super();
            this.finished = false;
            this.destroyed = false;
            ahash(hash);
            const key = toBytes(_key);
            this.iHash = hash.create();
            if (typeof this.iHash.update !== 'function')
                throw new Error('Expected instance of class which extends utils.Hash');
            this.blockLen = this.iHash.blockLen;
            this.outputLen = this.iHash.outputLen;
            const blockLen = this.blockLen;
            const pad = new Uint8Array(blockLen);
            // blockLen can be bigger than outputLen
            pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
            for (let i = 0; i < pad.length; i++)
                pad[i] ^= 0x36;
            this.iHash.update(pad);
            // By doing update (processing of first block) of outer hash here we can re-use it between multiple calls via clone
            this.oHash = hash.create();
            // Undo internal XOR && apply outer XOR
            for (let i = 0; i < pad.length; i++)
                pad[i] ^= 0x36 ^ 0x5c;
            this.oHash.update(pad);
            clean(pad);
        }
        update(buf) {
            aexists(this);
            this.iHash.update(buf);
            return this;
        }
        digestInto(out) {
            aexists(this);
            abytes(out, this.outputLen);
            this.finished = true;
            this.iHash.digestInto(out);
            this.oHash.update(out);
            this.oHash.digestInto(out);
            this.destroy();
        }
        digest() {
            const out = new Uint8Array(this.oHash.outputLen);
            this.digestInto(out);
            return out;
        }
        _cloneInto(to) {
            // Create new instance without calling constructor since key already in state and we don't know it.
            to || (to = Object.create(Object.getPrototypeOf(this), {}));
            const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
            to = to;
            to.finished = finished;
            to.destroyed = destroyed;
            to.blockLen = blockLen;
            to.outputLen = outputLen;
            to.oHash = oHash._cloneInto(to.oHash);
            to.iHash = iHash._cloneInto(to.iHash);
            return to;
        }
        clone() {
            return this._cloneInto();
        }
        destroy() {
            this.destroyed = true;
            this.oHash.destroy();
            this.iHash.destroy();
        }
    }
    /**
     * HMAC: RFC2104 message authentication code.
     * @param hash - function that would be used e.g. sha256
     * @param key - message key
     * @param message - message data
     * @example
     * import { hmac } from '@noble/hashes/hmac';
     * import { sha256 } from '@noble/hashes/sha2';
     * const mac1 = hmac(sha256, 'key', 'message');
     */
    const hmac = (hash, key, message) => new HMAC(hash, key).update(message).digest();
    hmac.create = (hash, key) => new HMAC(hash, key);

    /**
     * PBKDF (RFC 2898). Can be used to create a key from password and salt.
     * @module
     */
    // Common prologue and epilogue for sync/async functions
    function pbkdf2Init(hash, _password, _salt, _opts) {
        ahash(hash);
        const opts = checkOpts({ dkLen: 32, asyncTick: 10 }, _opts);
        const { c, dkLen, asyncTick } = opts;
        anumber(c);
        anumber(dkLen);
        anumber(asyncTick);
        if (c < 1)
            throw new Error('iterations (c) should be >= 1');
        const password = kdfInputToBytes(_password);
        const salt = kdfInputToBytes(_salt);
        // DK = PBKDF2(PRF, Password, Salt, c, dkLen);
        const DK = new Uint8Array(dkLen);
        // U1 = PRF(Password, Salt + INT_32_BE(i))
        const PRF = hmac.create(hash, password);
        const PRFSalt = PRF._cloneInto().update(salt);
        return { c, dkLen, asyncTick, DK, PRF, PRFSalt };
    }
    function pbkdf2Output(PRF, PRFSalt, DK, prfW, u) {
        PRF.destroy();
        PRFSalt.destroy();
        if (prfW)
            prfW.destroy();
        clean(u);
        return DK;
    }
    /**
     * PBKDF2-HMAC: RFC 2898 key derivation function
     * @param hash - hash function that would be used e.g. sha256
     * @param password - password from which a derived key is generated
     * @param salt - cryptographic salt
     * @param opts - {c, dkLen} where c is work factor and dkLen is output message size
     * @example
     * const key = pbkdf2(sha256, 'password', 'salt', { dkLen: 32, c: Math.pow(2, 18) });
     */
    function pbkdf2(hash, password, salt, opts) {
        const { c, dkLen, DK, PRF, PRFSalt } = pbkdf2Init(hash, password, salt, opts);
        let prfW; // Working copy
        const arr = new Uint8Array(4);
        const view = createView(arr);
        const u = new Uint8Array(PRF.outputLen);
        // DK = T1 + T2 + ⋯ + Tdklen/hlen
        for (let ti = 1, pos = 0; pos < dkLen; ti++, pos += PRF.outputLen) {
            // Ti = F(Password, Salt, c, i)
            const Ti = DK.subarray(pos, pos + PRF.outputLen);
            view.setInt32(0, ti, false);
            // F(Password, Salt, c, i) = U1 ^ U2 ^ ⋯ ^ Uc
            // U1 = PRF(Password, Salt + INT_32_BE(i))
            (prfW = PRFSalt._cloneInto(prfW)).update(arr).digestInto(u);
            Ti.set(u.subarray(0, Ti.length));
            for (let ui = 1; ui < c; ui++) {
                // Uc = PRF(Password, Uc−1)
                PRF._cloneInto(prfW).update(u).digestInto(u);
                for (let i = 0; i < Ti.length; i++)
                    Ti[i] ^= u[i];
            }
        }
        return pbkdf2Output(PRF, PRFSalt, DK, prfW, u);
    }

    /**
     * SHA2 hash function. A.k.a. sha256, sha384, sha512, sha512_224, sha512_256.
     * SHA256 is the fastest hash implementable in JS, even faster than Blake3.
     * Check out [RFC 4634](https://datatracker.ietf.org/doc/html/rfc4634) and
     * [FIPS 180-4](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf).
     * @module
     */
    /**
     * Round constants:
     * First 32 bits of fractional parts of the cube roots of the first 64 primes 2..311)
     */
    // prettier-ignore
    const SHA256_K = /* @__PURE__ */ Uint32Array.from([
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ]);
    /** Reusable temporary buffer. "W" comes straight from spec. */
    const SHA256_W = /* @__PURE__ */ new Uint32Array(64);
    class SHA256 extends HashMD {
        constructor(outputLen = 32) {
            super(64, outputLen, 8, false);
            // We cannot use array here since array allows indexing by variable
            // which means optimizer/compiler cannot use registers.
            this.A = SHA256_IV[0] | 0;
            this.B = SHA256_IV[1] | 0;
            this.C = SHA256_IV[2] | 0;
            this.D = SHA256_IV[3] | 0;
            this.E = SHA256_IV[4] | 0;
            this.F = SHA256_IV[5] | 0;
            this.G = SHA256_IV[6] | 0;
            this.H = SHA256_IV[7] | 0;
        }
        get() {
            const { A, B, C, D, E, F, G, H } = this;
            return [A, B, C, D, E, F, G, H];
        }
        // prettier-ignore
        set(A, B, C, D, E, F, G, H) {
            this.A = A | 0;
            this.B = B | 0;
            this.C = C | 0;
            this.D = D | 0;
            this.E = E | 0;
            this.F = F | 0;
            this.G = G | 0;
            this.H = H | 0;
        }
        process(view, offset) {
            // Extend the first 16 words into the remaining 48 words w[16..63] of the message schedule array
            for (let i = 0; i < 16; i++, offset += 4)
                SHA256_W[i] = view.getUint32(offset, false);
            for (let i = 16; i < 64; i++) {
                const W15 = SHA256_W[i - 15];
                const W2 = SHA256_W[i - 2];
                const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ (W15 >>> 3);
                const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ (W2 >>> 10);
                SHA256_W[i] = (s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16]) | 0;
            }
            // Compression function main loop, 64 rounds
            let { A, B, C, D, E, F, G, H } = this;
            for (let i = 0; i < 64; i++) {
                const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
                const T1 = (H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i]) | 0;
                const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
                const T2 = (sigma0 + Maj(A, B, C)) | 0;
                H = G;
                G = F;
                F = E;
                E = (D + T1) | 0;
                D = C;
                C = B;
                B = A;
                A = (T1 + T2) | 0;
            }
            // Add the compressed chunk to the current hash value
            A = (A + this.A) | 0;
            B = (B + this.B) | 0;
            C = (C + this.C) | 0;
            D = (D + this.D) | 0;
            E = (E + this.E) | 0;
            F = (F + this.F) | 0;
            G = (G + this.G) | 0;
            H = (H + this.H) | 0;
            this.set(A, B, C, D, E, F, G, H);
        }
        roundClean() {
            clean(SHA256_W);
        }
        destroy() {
            this.set(0, 0, 0, 0, 0, 0, 0, 0);
            clean(this.buffer);
        }
    }
    // SHA2-512 is slower than sha256 in js because u64 operations are slow.
    // Round contants
    // First 32 bits of the fractional parts of the cube roots of the first 80 primes 2..409
    // prettier-ignore
    const K512 = /* @__PURE__ */ (() => split([
        '0x428a2f98d728ae22', '0x7137449123ef65cd', '0xb5c0fbcfec4d3b2f', '0xe9b5dba58189dbbc',
        '0x3956c25bf348b538', '0x59f111f1b605d019', '0x923f82a4af194f9b', '0xab1c5ed5da6d8118',
        '0xd807aa98a3030242', '0x12835b0145706fbe', '0x243185be4ee4b28c', '0x550c7dc3d5ffb4e2',
        '0x72be5d74f27b896f', '0x80deb1fe3b1696b1', '0x9bdc06a725c71235', '0xc19bf174cf692694',
        '0xe49b69c19ef14ad2', '0xefbe4786384f25e3', '0x0fc19dc68b8cd5b5', '0x240ca1cc77ac9c65',
        '0x2de92c6f592b0275', '0x4a7484aa6ea6e483', '0x5cb0a9dcbd41fbd4', '0x76f988da831153b5',
        '0x983e5152ee66dfab', '0xa831c66d2db43210', '0xb00327c898fb213f', '0xbf597fc7beef0ee4',
        '0xc6e00bf33da88fc2', '0xd5a79147930aa725', '0x06ca6351e003826f', '0x142929670a0e6e70',
        '0x27b70a8546d22ffc', '0x2e1b21385c26c926', '0x4d2c6dfc5ac42aed', '0x53380d139d95b3df',
        '0x650a73548baf63de', '0x766a0abb3c77b2a8', '0x81c2c92e47edaee6', '0x92722c851482353b',
        '0xa2bfe8a14cf10364', '0xa81a664bbc423001', '0xc24b8b70d0f89791', '0xc76c51a30654be30',
        '0xd192e819d6ef5218', '0xd69906245565a910', '0xf40e35855771202a', '0x106aa07032bbd1b8',
        '0x19a4c116b8d2d0c8', '0x1e376c085141ab53', '0x2748774cdf8eeb99', '0x34b0bcb5e19b48a8',
        '0x391c0cb3c5c95a63', '0x4ed8aa4ae3418acb', '0x5b9cca4f7763e373', '0x682e6ff3d6b2b8a3',
        '0x748f82ee5defb2fc', '0x78a5636f43172f60', '0x84c87814a1f0ab72', '0x8cc702081a6439ec',
        '0x90befffa23631e28', '0xa4506cebde82bde9', '0xbef9a3f7b2c67915', '0xc67178f2e372532b',
        '0xca273eceea26619c', '0xd186b8c721c0c207', '0xeada7dd6cde0eb1e', '0xf57d4f7fee6ed178',
        '0x06f067aa72176fba', '0x0a637dc5a2c898a6', '0x113f9804bef90dae', '0x1b710b35131c471b',
        '0x28db77f523047d84', '0x32caab7b40c72493', '0x3c9ebe0a15c9bebc', '0x431d67c49c100d4c',
        '0x4cc5d4becb3e42b6', '0x597f299cfc657e2a', '0x5fcb6fab3ad6faec', '0x6c44198c4a475817'
    ].map(n => BigInt(n))))();
    const SHA512_Kh = /* @__PURE__ */ (() => K512[0])();
    const SHA512_Kl = /* @__PURE__ */ (() => K512[1])();
    // Reusable temporary buffers
    const SHA512_W_H = /* @__PURE__ */ new Uint32Array(80);
    const SHA512_W_L = /* @__PURE__ */ new Uint32Array(80);
    class SHA512 extends HashMD {
        constructor(outputLen = 64) {
            super(128, outputLen, 16, false);
            // We cannot use array here since array allows indexing by variable
            // which means optimizer/compiler cannot use registers.
            // h -- high 32 bits, l -- low 32 bits
            this.Ah = SHA512_IV[0] | 0;
            this.Al = SHA512_IV[1] | 0;
            this.Bh = SHA512_IV[2] | 0;
            this.Bl = SHA512_IV[3] | 0;
            this.Ch = SHA512_IV[4] | 0;
            this.Cl = SHA512_IV[5] | 0;
            this.Dh = SHA512_IV[6] | 0;
            this.Dl = SHA512_IV[7] | 0;
            this.Eh = SHA512_IV[8] | 0;
            this.El = SHA512_IV[9] | 0;
            this.Fh = SHA512_IV[10] | 0;
            this.Fl = SHA512_IV[11] | 0;
            this.Gh = SHA512_IV[12] | 0;
            this.Gl = SHA512_IV[13] | 0;
            this.Hh = SHA512_IV[14] | 0;
            this.Hl = SHA512_IV[15] | 0;
        }
        // prettier-ignore
        get() {
            const { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
            return [Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl];
        }
        // prettier-ignore
        set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl) {
            this.Ah = Ah | 0;
            this.Al = Al | 0;
            this.Bh = Bh | 0;
            this.Bl = Bl | 0;
            this.Ch = Ch | 0;
            this.Cl = Cl | 0;
            this.Dh = Dh | 0;
            this.Dl = Dl | 0;
            this.Eh = Eh | 0;
            this.El = El | 0;
            this.Fh = Fh | 0;
            this.Fl = Fl | 0;
            this.Gh = Gh | 0;
            this.Gl = Gl | 0;
            this.Hh = Hh | 0;
            this.Hl = Hl | 0;
        }
        process(view, offset) {
            // Extend the first 16 words into the remaining 64 words w[16..79] of the message schedule array
            for (let i = 0; i < 16; i++, offset += 4) {
                SHA512_W_H[i] = view.getUint32(offset);
                SHA512_W_L[i] = view.getUint32((offset += 4));
            }
            for (let i = 16; i < 80; i++) {
                // s0 := (w[i-15] rightrotate 1) xor (w[i-15] rightrotate 8) xor (w[i-15] rightshift 7)
                const W15h = SHA512_W_H[i - 15] | 0;
                const W15l = SHA512_W_L[i - 15] | 0;
                const s0h = rotrSH(W15h, W15l, 1) ^ rotrSH(W15h, W15l, 8) ^ shrSH(W15h, W15l, 7);
                const s0l = rotrSL(W15h, W15l, 1) ^ rotrSL(W15h, W15l, 8) ^ shrSL(W15h, W15l, 7);
                // s1 := (w[i-2] rightrotate 19) xor (w[i-2] rightrotate 61) xor (w[i-2] rightshift 6)
                const W2h = SHA512_W_H[i - 2] | 0;
                const W2l = SHA512_W_L[i - 2] | 0;
                const s1h = rotrSH(W2h, W2l, 19) ^ rotrBH(W2h, W2l, 61) ^ shrSH(W2h, W2l, 6);
                const s1l = rotrSL(W2h, W2l, 19) ^ rotrBL(W2h, W2l, 61) ^ shrSL(W2h, W2l, 6);
                // SHA256_W[i] = s0 + s1 + SHA256_W[i - 7] + SHA256_W[i - 16];
                const SUMl = add4L(s0l, s1l, SHA512_W_L[i - 7], SHA512_W_L[i - 16]);
                const SUMh = add4H(SUMl, s0h, s1h, SHA512_W_H[i - 7], SHA512_W_H[i - 16]);
                SHA512_W_H[i] = SUMh | 0;
                SHA512_W_L[i] = SUMl | 0;
            }
            let { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
            // Compression function main loop, 80 rounds
            for (let i = 0; i < 80; i++) {
                // S1 := (e rightrotate 14) xor (e rightrotate 18) xor (e rightrotate 41)
                const sigma1h = rotrSH(Eh, El, 14) ^ rotrSH(Eh, El, 18) ^ rotrBH(Eh, El, 41);
                const sigma1l = rotrSL(Eh, El, 14) ^ rotrSL(Eh, El, 18) ^ rotrBL(Eh, El, 41);
                //const T1 = (H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i]) | 0;
                const CHIh = (Eh & Fh) ^ (~Eh & Gh);
                const CHIl = (El & Fl) ^ (~El & Gl);
                // T1 = H + sigma1 + Chi(E, F, G) + SHA512_K[i] + SHA512_W[i]
                // prettier-ignore
                const T1ll = add5L(Hl, sigma1l, CHIl, SHA512_Kl[i], SHA512_W_L[i]);
                const T1h = add5H(T1ll, Hh, sigma1h, CHIh, SHA512_Kh[i], SHA512_W_H[i]);
                const T1l = T1ll | 0;
                // S0 := (a rightrotate 28) xor (a rightrotate 34) xor (a rightrotate 39)
                const sigma0h = rotrSH(Ah, Al, 28) ^ rotrBH(Ah, Al, 34) ^ rotrBH(Ah, Al, 39);
                const sigma0l = rotrSL(Ah, Al, 28) ^ rotrBL(Ah, Al, 34) ^ rotrBL(Ah, Al, 39);
                const MAJh = (Ah & Bh) ^ (Ah & Ch) ^ (Bh & Ch);
                const MAJl = (Al & Bl) ^ (Al & Cl) ^ (Bl & Cl);
                Hh = Gh | 0;
                Hl = Gl | 0;
                Gh = Fh | 0;
                Gl = Fl | 0;
                Fh = Eh | 0;
                Fl = El | 0;
                ({ h: Eh, l: El } = add(Dh | 0, Dl | 0, T1h | 0, T1l | 0));
                Dh = Ch | 0;
                Dl = Cl | 0;
                Ch = Bh | 0;
                Cl = Bl | 0;
                Bh = Ah | 0;
                Bl = Al | 0;
                const All = add3L(T1l, sigma0l, MAJl);
                Ah = add3H(All, T1h, sigma0h, MAJh);
                Al = All | 0;
            }
            // Add the compressed chunk to the current hash value
            ({ h: Ah, l: Al } = add(this.Ah | 0, this.Al | 0, Ah | 0, Al | 0));
            ({ h: Bh, l: Bl } = add(this.Bh | 0, this.Bl | 0, Bh | 0, Bl | 0));
            ({ h: Ch, l: Cl } = add(this.Ch | 0, this.Cl | 0, Ch | 0, Cl | 0));
            ({ h: Dh, l: Dl } = add(this.Dh | 0, this.Dl | 0, Dh | 0, Dl | 0));
            ({ h: Eh, l: El } = add(this.Eh | 0, this.El | 0, Eh | 0, El | 0));
            ({ h: Fh, l: Fl } = add(this.Fh | 0, this.Fl | 0, Fh | 0, Fl | 0));
            ({ h: Gh, l: Gl } = add(this.Gh | 0, this.Gl | 0, Gh | 0, Gl | 0));
            ({ h: Hh, l: Hl } = add(this.Hh | 0, this.Hl | 0, Hh | 0, Hl | 0));
            this.set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl);
        }
        roundClean() {
            clean(SHA512_W_H, SHA512_W_L);
        }
        destroy() {
            clean(this.buffer);
            this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        }
    }
    class SHA384 extends SHA512 {
        constructor() {
            super(48);
            this.Ah = SHA384_IV[0] | 0;
            this.Al = SHA384_IV[1] | 0;
            this.Bh = SHA384_IV[2] | 0;
            this.Bl = SHA384_IV[3] | 0;
            this.Ch = SHA384_IV[4] | 0;
            this.Cl = SHA384_IV[5] | 0;
            this.Dh = SHA384_IV[6] | 0;
            this.Dl = SHA384_IV[7] | 0;
            this.Eh = SHA384_IV[8] | 0;
            this.El = SHA384_IV[9] | 0;
            this.Fh = SHA384_IV[10] | 0;
            this.Fl = SHA384_IV[11] | 0;
            this.Gh = SHA384_IV[12] | 0;
            this.Gl = SHA384_IV[13] | 0;
            this.Hh = SHA384_IV[14] | 0;
            this.Hl = SHA384_IV[15] | 0;
        }
    }
    /**
     * Truncated SHA512/256 and SHA512/224.
     * SHA512_IV is XORed with 0xa5a5a5a5a5a5a5a5, then used as "intermediary" IV of SHA512/t.
     * Then t hashes string to produce result IV.
     * See `test/misc/sha2-gen-iv.js`.
     */
    /** SHA512/224 IV */
    const T224_IV = /* @__PURE__ */ Uint32Array.from([
        0x8c3d37c8, 0x19544da2, 0x73e19966, 0x89dcd4d6, 0x1dfab7ae, 0x32ff9c82, 0x679dd514, 0x582f9fcf,
        0x0f6d2b69, 0x7bd44da8, 0x77e36f73, 0x04c48942, 0x3f9d85a8, 0x6a1d36c8, 0x1112e6ad, 0x91d692a1,
    ]);
    /** SHA512/256 IV */
    const T256_IV = /* @__PURE__ */ Uint32Array.from([
        0x22312194, 0xfc2bf72c, 0x9f555fa3, 0xc84c64c2, 0x2393b86b, 0x6f53b151, 0x96387719, 0x5940eabd,
        0x96283ee2, 0xa88effe3, 0xbe5e1e25, 0x53863992, 0x2b0199fc, 0x2c85b8aa, 0x0eb72ddc, 0x81c52ca2,
    ]);
    class SHA512_224 extends SHA512 {
        constructor() {
            super(28);
            this.Ah = T224_IV[0] | 0;
            this.Al = T224_IV[1] | 0;
            this.Bh = T224_IV[2] | 0;
            this.Bl = T224_IV[3] | 0;
            this.Ch = T224_IV[4] | 0;
            this.Cl = T224_IV[5] | 0;
            this.Dh = T224_IV[6] | 0;
            this.Dl = T224_IV[7] | 0;
            this.Eh = T224_IV[8] | 0;
            this.El = T224_IV[9] | 0;
            this.Fh = T224_IV[10] | 0;
            this.Fl = T224_IV[11] | 0;
            this.Gh = T224_IV[12] | 0;
            this.Gl = T224_IV[13] | 0;
            this.Hh = T224_IV[14] | 0;
            this.Hl = T224_IV[15] | 0;
        }
    }
    class SHA512_256 extends SHA512 {
        constructor() {
            super(32);
            this.Ah = T256_IV[0] | 0;
            this.Al = T256_IV[1] | 0;
            this.Bh = T256_IV[2] | 0;
            this.Bl = T256_IV[3] | 0;
            this.Ch = T256_IV[4] | 0;
            this.Cl = T256_IV[5] | 0;
            this.Dh = T256_IV[6] | 0;
            this.Dl = T256_IV[7] | 0;
            this.Eh = T256_IV[8] | 0;
            this.El = T256_IV[9] | 0;
            this.Fh = T256_IV[10] | 0;
            this.Fl = T256_IV[11] | 0;
            this.Gh = T256_IV[12] | 0;
            this.Gl = T256_IV[13] | 0;
            this.Hh = T256_IV[14] | 0;
            this.Hl = T256_IV[15] | 0;
        }
    }
    /** SHA2-512 hash function from RFC 4634. */
    const sha512$1 = /* @__PURE__ */ createHasher(() => new SHA512());
    /** SHA2-384 hash function from RFC 4634. */
    const sha384 = /* @__PURE__ */ createHasher(() => new SHA384());
    /**
     * SHA2-512/256 "truncated" hash function, with improved resistance to length extension attacks.
     * See the paper on [truncated SHA512](https://eprint.iacr.org/2010/548.pdf).
     */
    const sha512_256 = /* @__PURE__ */ createHasher(() => new SHA512_256());
    /**
     * SHA2-512/224 "truncated" hash function, with improved resistance to length extension attacks.
     * See the paper on [truncated SHA512](https://eprint.iacr.org/2010/548.pdf).
     */
    const sha512_224 = /* @__PURE__ */ createHasher(() => new SHA512_224());

    /**
     * Audited & minimal JS implementation of
     * [BIP39 mnemonic phrases](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki).
     * @module
     * @example
    ```js
    import * as bip39 from '@scure/bip39';
    import { wordlist } from '@scure/bip39/wordlists/english';
    const mn = bip39.generateMnemonic(wordlist);
    console.log(mn);
    const ent = bip39.mnemonicToEntropy(mn, wordlist)
    bip39.entropyToMnemonic(ent, wordlist);
    bip39.validateMnemonic(mn, wordlist);
    await bip39.mnemonicToSeed(mn, 'password');
    bip39.mnemonicToSeedSync(mn, 'password');

    // Wordlists
    import { wordlist as czech } from '@scure/bip39/wordlists/czech';
    import { wordlist as english } from '@scure/bip39/wordlists/english';
    import { wordlist as french } from '@scure/bip39/wordlists/french';
    import { wordlist as italian } from '@scure/bip39/wordlists/italian';
    import { wordlist as japanese } from '@scure/bip39/wordlists/japanese';
    import { wordlist as korean } from '@scure/bip39/wordlists/korean';
    import { wordlist as portuguese } from '@scure/bip39/wordlists/portuguese';
    import { wordlist as simplifiedChinese } from '@scure/bip39/wordlists/simplified-chinese';
    import { wordlist as spanish } from '@scure/bip39/wordlists/spanish';
    import { wordlist as traditionalChinese } from '@scure/bip39/wordlists/traditional-chinese';
    ```
     */
    // Normalization replaces equivalent sequences of characters
    // so that any two texts that are equivalent will be reduced
    // to the same sequence of code points, called the normal form of the original text.
    // https://tonsky.me/blog/unicode/#why-is-a----
    function nfkd(str) {
        if (typeof str !== 'string')
            throw new TypeError('invalid mnemonic type: ' + typeof str);
        return str.normalize('NFKD');
    }
    function normalize(str) {
        const norm = nfkd(str);
        const words = norm.split(' ');
        if (![12, 15, 18, 21, 24].includes(words.length))
            throw new Error('Invalid mnemonic');
        return { nfkd: norm, words };
    }
    const psalt = (passphrase) => nfkd('mnemonic' + passphrase);
    /**
     * Irreversible: Uses KDF to derive 64 bytes of key data from mnemonic + optional password.
     * @param mnemonic 12-24 words
     * @param passphrase string that will additionally protect the key
     * @returns 64 bytes of key data
     * @example
     * const mnem = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
     * mnemonicToSeedSync(mnem, 'password');
     * // new Uint8Array([...64 bytes])
     */
    function mnemonicToSeedSync(mnemonic, passphrase = '') {
        return pbkdf2(sha512$1, normalize(mnemonic).nfkd, psalt(passphrase), { c: 2048, dkLen: 64 });
    }

    function isValidHardenedPath(path) {
      if (!new RegExp("^m\\/44'\\/784'\\/[0-9]+'\\/[0-9]+'\\/[0-9]+'+$").test(path)) {
        return false;
      }
      return true;
    }
    function mnemonicToSeed(mnemonics) {
      return mnemonicToSeedSync(mnemonics, "");
    }
    function mnemonicToSeedHex(mnemonics) {
      return toHEX(mnemonicToSeed(mnemonics));
    }

    /**
     * SHA2-512 a.k.a. sha512 and sha384. It is slower than sha256 in js because u64 operations are slow.
     *
     * Check out [RFC 4634](https://datatracker.ietf.org/doc/html/rfc4634) and
     * [the paper on truncated SHA512/256](https://eprint.iacr.org/2010/548.pdf).
     * @module
     * @deprecated
     */
    /** @deprecated Use import from `noble/hashes/sha2` module */
    SHA512;
    /** @deprecated Use import from `noble/hashes/sha2` module */
    const sha512 = sha512$1;
    /** @deprecated Use import from `noble/hashes/sha2` module */
    SHA384;
    /** @deprecated Use import from `noble/hashes/sha2` module */
    sha384;
    /** @deprecated Use import from `noble/hashes/sha2` module */
    SHA512_224;
    /** @deprecated Use import from `noble/hashes/sha2` module */
    sha512_224;
    /** @deprecated Use import from `noble/hashes/sha2` module */
    SHA512_256;
    /** @deprecated Use import from `noble/hashes/sha2` module */
    sha512_256;

    const ED25519_CURVE = "ed25519 seed";
    const HARDENED_OFFSET = 2147483648;
    const pathRegex = new RegExp("^m(\\/[0-9]+')+$");
    const replaceDerive = (val) => val.replace("'", "");
    const getMasterKeyFromSeed = (seed) => {
      const h = hmac.create(sha512, ED25519_CURVE);
      const I = h.update(fromHEX(seed)).digest();
      const IL = I.slice(0, 32);
      const IR = I.slice(32);
      return {
        key: IL,
        chainCode: IR
      };
    };
    const CKDPriv = ({ key, chainCode }, index) => {
      const indexBuffer = new ArrayBuffer(4);
      const cv = new DataView(indexBuffer);
      cv.setUint32(0, index);
      const data = new Uint8Array(1 + key.length + indexBuffer.byteLength);
      data.set(new Uint8Array(1).fill(0));
      data.set(key, 1);
      data.set(new Uint8Array(indexBuffer, 0, indexBuffer.byteLength), key.length + 1);
      const I = hmac.create(sha512, chainCode).update(data).digest();
      const IL = I.slice(0, 32);
      const IR = I.slice(32);
      return {
        key: IL,
        chainCode: IR
      };
    };
    const isValidPath = (path) => {
      if (!pathRegex.test(path)) {
        return false;
      }
      return !path.split("/").slice(1).map(replaceDerive).some(
        isNaN
        /* ts T_T*/
      );
    };
    const derivePath = (path, seed, offset = HARDENED_OFFSET) => {
      if (!isValidPath(path)) {
        throw new Error("Invalid derivation path");
      }
      const { key, chainCode } = getMasterKeyFromSeed(seed);
      const segments = path.split("/").slice(1).map(replaceDerive).map((el) => parseInt(el, 10));
      return segments.reduce((parentKeys, segment) => CKDPriv(parentKeys, segment + offset), {
        key,
        chainCode
      });
    };

    const PUBLIC_KEY_SIZE = 32;
    class Ed25519PublicKey extends PublicKey {
      /**
       * Create a new Ed25519PublicKey object
       * @param value ed25519 public key as buffer or base-64 encoded string
       */
      constructor(value) {
        super();
        if (typeof value === "string") {
          this.data = fromB64(value);
        } else if (value instanceof Uint8Array) {
          this.data = value;
        } else {
          this.data = Uint8Array.from(value);
        }
        if (this.data.length !== PUBLIC_KEY_SIZE) {
          throw new Error(
            `Invalid public key input. Expected ${PUBLIC_KEY_SIZE} bytes, got ${this.data.length}`
          );
        }
      }
      /**
       * Checks if two Ed25519 public keys are equal
       */
      equals(publicKey) {
        return super.equals(publicKey);
      }
      /**
       * Return the byte array representation of the Ed25519 public key
       */
      toRawBytes() {
        return this.data;
      }
      /**
       * Return the Sui address associated with this Ed25519 public key
       */
      flag() {
        return SIGNATURE_SCHEME_TO_FLAG["ED25519"];
      }
      /**
       * Verifies that the signature is valid for for the provided message
       */
      async verify(message, signature) {
        let bytes;
        if (typeof signature === "string") {
          const parsed = parseSerializedSignature(signature);
          if (parsed.signatureScheme !== "ED25519") {
            throw new Error("Invalid signature scheme");
          }
          if (!bytesEqual(this.toRawBytes(), parsed.publicKey)) {
            throw new Error("Signature does not match public key");
          }
          bytes = parsed.signature;
        } else {
          bytes = signature;
        }
        return nacl.sign.detached.verify(message, bytes, this.toRawBytes());
      }
    }
    Ed25519PublicKey.SIZE = PUBLIC_KEY_SIZE;

    const DEFAULT_ED25519_DERIVATION_PATH = "m/44'/784'/0'/0'/0'";
    class Ed25519Keypair extends Keypair {
      /**
       * Create a new Ed25519 keypair instance.
       * Generate random keypair if no {@link Ed25519Keypair} is provided.
       *
       * @param keypair Ed25519 keypair
       */
      constructor(keypair) {
        super();
        if (keypair) {
          this.keypair = keypair;
        } else {
          this.keypair = nacl.sign.keyPair();
        }
      }
      /**
       * Get the key scheme of the keypair ED25519
       */
      getKeyScheme() {
        return "ED25519";
      }
      /**
       * Generate a new random Ed25519 keypair
       */
      static generate() {
        return new Ed25519Keypair(nacl.sign.keyPair());
      }
      /**
       * Create a Ed25519 keypair from a raw secret key byte array, also known as seed.
       * This is NOT the private scalar which is result of hashing and bit clamping of
       * the raw secret key.
       *
       * @throws error if the provided secret key is invalid and validation is not skipped.
       *
       * @param secretKey secret key byte array
       * @param options: skip secret key validation
       */
      static fromSecretKey(secretKey, options) {
        const secretKeyLength = secretKey.length;
        if (secretKeyLength !== PRIVATE_KEY_SIZE) {
          throw new Error(
            `Wrong secretKey size. Expected ${PRIVATE_KEY_SIZE} bytes, got ${secretKeyLength}.`
          );
        }
        const keypair = nacl.sign.keyPair.fromSeed(secretKey);
        if (!options || !options.skipValidation) {
          const encoder = new TextEncoder();
          const signData = encoder.encode("sui validation");
          const signature = nacl.sign.detached(signData, keypair.secretKey);
          if (!nacl.sign.detached.verify(signData, signature, keypair.publicKey)) {
            throw new Error("provided secretKey is invalid");
          }
        }
        return new Ed25519Keypair(keypair);
      }
      /**
       * The public key for this Ed25519 keypair
       */
      getPublicKey() {
        return new Ed25519PublicKey(this.keypair.publicKey);
      }
      /**
       * The Bech32 secret key string for this Ed25519 keypair
       */
      getSecretKey() {
        return encodeSuiPrivateKey(
          this.keypair.secretKey.slice(0, PRIVATE_KEY_SIZE),
          this.getKeyScheme()
        );
      }
      async sign(data) {
        return this.signData(data);
      }
      /**
       * Return the signature for the provided data using Ed25519.
       */
      signData(data) {
        return nacl.sign.detached(data, this.keypair.secretKey);
      }
      /**
       * Derive Ed25519 keypair from mnemonics and path. The mnemonics must be normalized
       * and validated against the english wordlist.
       *
       * If path is none, it will default to m/44'/784'/0'/0'/0', otherwise the path must
       * be compliant to SLIP-0010 in form m/44'/784'/{account_index}'/{change_index}'/{address_index}'.
       */
      static deriveKeypair(mnemonics, path) {
        if (path == null) {
          path = DEFAULT_ED25519_DERIVATION_PATH;
        }
        if (!isValidHardenedPath(path)) {
          throw new Error("Invalid derivation path");
        }
        const { key } = derivePath(path, mnemonicToSeedHex(mnemonics));
        return Ed25519Keypair.fromSecretKey(key);
      }
      /**
       * Derive Ed25519 keypair from mnemonicSeed and path.
       *
       * If path is none, it will default to m/44'/784'/0'/0'/0', otherwise the path must
       * be compliant to SLIP-0010 in form m/44'/784'/{account_index}'/{change_index}'/{address_index}'.
       */
      static deriveKeypairFromSeed(seedHex, path) {
        if (path == null) {
          path = DEFAULT_ED25519_DERIVATION_PATH;
        }
        if (!isValidHardenedPath(path)) {
          throw new Error("Invalid derivation path");
        }
        const { key } = derivePath(path, seedHex);
        return Ed25519Keypair.fromSecretKey(key);
      }
    }

    const PACKAGE_VERSION = "0.54.1";
    const TARGETED_RPC_VERSION = "1.25.0";

    const CODE_TO_ERROR_TYPE = {
      "-32700": "ParseError",
      "-32600": "InvalidRequest",
      "-32601": "MethodNotFound",
      "-32602": "InvalidParams",
      "-32603": "InternalError"
    };
    class SuiHTTPTransportError extends Error {
    }
    class JsonRpcError extends SuiHTTPTransportError {
      constructor(message, code) {
        super(message);
        this.code = code;
        this.type = CODE_TO_ERROR_TYPE[code] ?? "ServerError";
      }
    }
    class SuiHTTPStatusError extends SuiHTTPTransportError {
      constructor(message, status, statusText) {
        super(message);
        this.status = status;
        this.statusText = statusText;
      }
    }

    var __accessCheck$2 = (obj, member, msg) => {
      if (!member.has(obj))
        throw TypeError("Cannot " + msg);
    };
    var __privateGet$2 = (obj, member, getter) => {
      __accessCheck$2(obj, member, "read from private field");
      return getter ? getter.call(obj) : member.get(obj);
    };
    var __privateAdd$2 = (obj, member, value) => {
      if (member.has(obj))
        throw TypeError("Cannot add the same private member more than once");
      member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
    };
    var __privateSet$2 = (obj, member, value, setter) => {
      __accessCheck$2(obj, member, "write to private field");
      setter ? setter.call(obj, value) : member.set(obj, value);
      return value;
    };
    var __privateWrapper = (obj, member, setter, getter) => ({
      set _(value) {
        __privateSet$2(obj, member, value, setter);
      },
      get _() {
        return __privateGet$2(obj, member, getter);
      }
    });
    var __privateMethod$2 = (obj, member, method) => {
      __accessCheck$2(obj, member, "access private method");
      return method;
    };
    var _requestId$1, _disconnects, _webSocket, _connectionPromise, _subscriptions, _pendingRequests, _setupWebSocket, setupWebSocket_fn, _reconnect, reconnect_fn;
    function getWebsocketUrl(httpUrl) {
      const url = new URL(httpUrl);
      url.protocol = url.protocol.replace("http", "ws");
      return url.toString();
    }
    const DEFAULT_CLIENT_OPTIONS = {
      // We fudge the typing because we also check for undefined in the constructor:
      WebSocketConstructor: typeof WebSocket !== "undefined" ? WebSocket : void 0,
      callTimeout: 3e4,
      reconnectTimeout: 3e3,
      maxReconnects: 5
    };
    class WebsocketClient {
      constructor(endpoint, options = {}) {
        __privateAdd$2(this, _setupWebSocket);
        __privateAdd$2(this, _reconnect);
        __privateAdd$2(this, _requestId$1, 0);
        __privateAdd$2(this, _disconnects, 0);
        __privateAdd$2(this, _webSocket, null);
        __privateAdd$2(this, _connectionPromise, null);
        __privateAdd$2(this, _subscriptions, /* @__PURE__ */ new Set());
        __privateAdd$2(this, _pendingRequests, /* @__PURE__ */ new Map());
        this.endpoint = endpoint;
        this.options = { ...DEFAULT_CLIENT_OPTIONS, ...options };
        if (!this.options.WebSocketConstructor) {
          throw new Error("Missing WebSocket constructor");
        }
        if (this.endpoint.startsWith("http")) {
          this.endpoint = getWebsocketUrl(this.endpoint);
        }
      }
      async makeRequest(method, params) {
        const webSocket = await __privateMethod$2(this, _setupWebSocket, setupWebSocket_fn).call(this);
        return new Promise((resolve, reject) => {
          __privateSet$2(this, _requestId$1, __privateGet$2(this, _requestId$1) + 1);
          __privateGet$2(this, _pendingRequests).set(__privateGet$2(this, _requestId$1), {
            resolve,
            reject,
            timeout: setTimeout(() => {
              __privateGet$2(this, _pendingRequests).delete(__privateGet$2(this, _requestId$1));
              reject(new Error(`Request timeout: ${method}`));
            }, this.options.callTimeout)
          });
          webSocket.send(JSON.stringify({ jsonrpc: "2.0", id: __privateGet$2(this, _requestId$1), method, params }));
        }).then(({ error, result }) => {
          if (error) {
            throw new JsonRpcError(error.message, error.code);
          }
          return result;
        });
      }
      async subscribe(input) {
        const subscription = new RpcSubscription(input);
        __privateGet$2(this, _subscriptions).add(subscription);
        await subscription.subscribe(this);
        return () => subscription.unsubscribe(this);
      }
    }
    _requestId$1 = new WeakMap();
    _disconnects = new WeakMap();
    _webSocket = new WeakMap();
    _connectionPromise = new WeakMap();
    _subscriptions = new WeakMap();
    _pendingRequests = new WeakMap();
    _setupWebSocket = new WeakSet();
    setupWebSocket_fn = function() {
      if (__privateGet$2(this, _connectionPromise)) {
        return __privateGet$2(this, _connectionPromise);
      }
      __privateSet$2(this, _connectionPromise, new Promise((resolve) => {
        __privateGet$2(this, _webSocket)?.close();
        __privateSet$2(this, _webSocket, new this.options.WebSocketConstructor(this.endpoint));
        __privateGet$2(this, _webSocket).addEventListener("open", () => {
          __privateSet$2(this, _disconnects, 0);
          resolve(__privateGet$2(this, _webSocket));
        });
        __privateGet$2(this, _webSocket).addEventListener("close", () => {
          __privateWrapper(this, _disconnects)._++;
          if (__privateGet$2(this, _disconnects) <= this.options.maxReconnects) {
            setTimeout(() => {
              __privateMethod$2(this, _reconnect, reconnect_fn).call(this);
            }, this.options.reconnectTimeout);
          }
        });
        __privateGet$2(this, _webSocket).addEventListener("message", ({ data }) => {
          let json;
          try {
            json = JSON.parse(data);
          } catch (error) {
            console.error(new Error(`Failed to parse RPC message: ${data}`, { cause: error }));
            return;
          }
          if ("id" in json && json.id != null && __privateGet$2(this, _pendingRequests).has(json.id)) {
            const { resolve: resolve2, timeout } = __privateGet$2(this, _pendingRequests).get(json.id);
            clearTimeout(timeout);
            resolve2(json);
          } else if ("params" in json) {
            const { params } = json;
            __privateGet$2(this, _subscriptions).forEach((subscription) => {
              if (subscription.subscriptionId === params.subscription) {
                if (params.subscription === subscription.subscriptionId) {
                  subscription.onMessage(params.result);
                }
              }
            });
          }
        });
      }));
      return __privateGet$2(this, _connectionPromise);
    };
    _reconnect = new WeakSet();
    reconnect_fn = async function() {
      __privateGet$2(this, _webSocket)?.close();
      __privateSet$2(this, _connectionPromise, null);
      return Promise.allSettled(
        [...__privateGet$2(this, _subscriptions)].map((subscription) => subscription.subscribe(this))
      );
    };
    class RpcSubscription {
      constructor(input) {
        this.subscriptionId = null;
        this.subscribed = false;
        this.input = input;
      }
      onMessage(message) {
        if (this.subscribed) {
          this.input.onMessage(message);
        }
      }
      async unsubscribe(client) {
        const { subscriptionId } = this;
        this.subscribed = false;
        if (subscriptionId == null)
          return false;
        this.subscriptionId = null;
        return client.makeRequest(this.input.unsubscribe, [subscriptionId]);
      }
      async subscribe(client) {
        this.subscriptionId = null;
        this.subscribed = true;
        const newSubscriptionId = await client.makeRequest(
          this.input.method,
          this.input.params
        );
        if (this.subscribed) {
          this.subscriptionId = newSubscriptionId;
        }
      }
    }

    var __accessCheck$1 = (obj, member, msg) => {
      if (!member.has(obj))
        throw TypeError("Cannot " + msg);
    };
    var __privateGet$1 = (obj, member, getter) => {
      __accessCheck$1(obj, member, "read from private field");
      return getter ? getter.call(obj) : member.get(obj);
    };
    var __privateAdd$1 = (obj, member, value) => {
      if (member.has(obj))
        throw TypeError("Cannot add the same private member more than once");
      member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
    };
    var __privateSet$1 = (obj, member, value, setter) => {
      __accessCheck$1(obj, member, "write to private field");
      setter ? setter.call(obj, value) : member.set(obj, value);
      return value;
    };
    var __privateMethod$1 = (obj, member, method) => {
      __accessCheck$1(obj, member, "access private method");
      return method;
    };
    var _requestId, _options, _websocketClient, _getWebsocketClient, getWebsocketClient_fn;
    class SuiHTTPTransport {
      constructor(options) {
        __privateAdd$1(this, _getWebsocketClient);
        __privateAdd$1(this, _requestId, 0);
        __privateAdd$1(this, _options, void 0);
        __privateAdd$1(this, _websocketClient, void 0);
        __privateSet$1(this, _options, options);
      }
      fetch(input, init) {
        const fetch = __privateGet$1(this, _options).fetch ?? globalThis.fetch;
        if (!fetch) {
          throw new Error(
            "The current environment does not support fetch, you can provide a fetch implementation in the options for SuiHTTPTransport."
          );
        }
        return fetch(input, init);
      }
      async request(input) {
        __privateSet$1(this, _requestId, __privateGet$1(this, _requestId) + 1);
        const res = await this.fetch(__privateGet$1(this, _options).rpc?.url ?? __privateGet$1(this, _options).url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Client-Sdk-Type": "typescript",
            "Client-Sdk-Version": PACKAGE_VERSION,
            "Client-Target-Api-Version": TARGETED_RPC_VERSION,
            ...__privateGet$1(this, _options).rpc?.headers
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: __privateGet$1(this, _requestId),
            method: input.method,
            params: input.params
          })
        });
        if (!res.ok) {
          throw new SuiHTTPStatusError(
            `Unexpected status code: ${res.status}`,
            res.status,
            res.statusText
          );
        }
        const data = await res.json();
        if ("error" in data && data.error != null) {
          throw new JsonRpcError(data.error.message, data.error.code);
        }
        return data.result;
      }
      async subscribe(input) {
        const unsubscribe = await __privateMethod$1(this, _getWebsocketClient, getWebsocketClient_fn).call(this).subscribe(input);
        return async () => !!await unsubscribe();
      }
    }
    _requestId = new WeakMap();
    _options = new WeakMap();
    _websocketClient = new WeakMap();
    _getWebsocketClient = new WeakSet();
    getWebsocketClient_fn = function() {
      if (!__privateGet$1(this, _websocketClient)) {
        const WebSocketConstructor = __privateGet$1(this, _options).WebSocketConstructor ?? globalThis.WebSocket;
        if (!WebSocketConstructor) {
          throw new Error(
            "The current environment does not support WebSocket, you can provide a WebSocketConstructor in the options for SuiHTTPTransport."
          );
        }
        __privateSet$1(this, _websocketClient, new WebsocketClient(
          __privateGet$1(this, _options).websocket?.url ?? __privateGet$1(this, _options).url,
          {
            WebSocketConstructor,
            ...__privateGet$1(this, _options).websocket
          }
        ));
      }
      return __privateGet$1(this, _websocketClient);
    };

    /**
     * A `StructFailure` represents a single specific failure in validation.
     */
    /**
     * `StructError` objects are thrown (or returned) when validation fails.
     *
     * Validation logic is design to exit early for maximum performance. The error
     * represents the first error encountered during validation. For more detail,
     * the `error.failures` property is a generator function that can be run to
     * continue validation and receive all the failures in the data.
     */
    class StructError extends TypeError {
        constructor(failure, failures) {
            let cached;
            const { message, explanation, ...rest } = failure;
            const { path } = failure;
            const msg = path.length === 0 ? message : `At path: ${path.join('.')} -- ${message}`;
            super(explanation ?? msg);
            if (explanation != null)
                this.cause = msg;
            Object.assign(this, rest);
            this.name = this.constructor.name;
            this.failures = () => {
                return (cached ?? (cached = [failure, ...failures()]));
            };
        }
    }

    /**
     * Check if a value is an iterator.
     */
    function isIterable(x) {
        return isObject(x) && typeof x[Symbol.iterator] === 'function';
    }
    /**
     * Check if a value is a plain object.
     */
    function isObject(x) {
        return typeof x === 'object' && x != null;
    }
    /**
     * Return a value as a printable string.
     */
    function print(value) {
        if (typeof value === 'symbol') {
            return value.toString();
        }
        return typeof value === 'string' ? JSON.stringify(value) : `${value}`;
    }
    /**
     * Shifts (removes and returns) the first value from the `input` iterator.
     * Like `Array.prototype.shift()` but for an `Iterator`.
     */
    function shiftIterator(input) {
        const { done, value } = input.next();
        return done ? undefined : value;
    }
    /**
     * Convert a single validation result to a failure.
     */
    function toFailure(result, context, struct, value) {
        if (result === true) {
            return;
        }
        else if (result === false) {
            result = {};
        }
        else if (typeof result === 'string') {
            result = { message: result };
        }
        const { path, branch } = context;
        const { type } = struct;
        const { refinement, message = `Expected a value of type \`${type}\`${refinement ? ` with refinement \`${refinement}\`` : ''}, but received: \`${print(value)}\``, } = result;
        return {
            value,
            type,
            refinement,
            key: path[path.length - 1],
            path,
            branch,
            ...result,
            message,
        };
    }
    /**
     * Convert a validation result to an iterable of failures.
     */
    function* toFailures(result, context, struct, value) {
        if (!isIterable(result)) {
            result = [result];
        }
        for (const r of result) {
            const failure = toFailure(r, context, struct, value);
            if (failure) {
                yield failure;
            }
        }
    }
    /**
     * Check a value against a struct, traversing deeply into nested values, and
     * returning an iterator of failures or success.
     */
    function* run(value, struct, options = {}) {
        const { path = [], branch = [value], coerce = false, mask = false } = options;
        const ctx = { path, branch };
        if (coerce) {
            value = struct.coercer(value, ctx);
            if (mask &&
                struct.type !== 'type' &&
                isObject(struct.schema) &&
                isObject(value) &&
                !Array.isArray(value)) {
                for (const key in value) {
                    if (struct.schema[key] === undefined) {
                        delete value[key];
                    }
                }
            }
        }
        let status = 'valid';
        for (const failure of struct.validator(value, ctx)) {
            failure.explanation = options.message;
            status = 'not_valid';
            yield [failure, undefined];
        }
        for (let [k, v, s] of struct.entries(value, ctx)) {
            const ts = run(v, s, {
                path: k === undefined ? path : [...path, k],
                branch: k === undefined ? branch : [...branch, v],
                coerce,
                mask,
                message: options.message,
            });
            for (const t of ts) {
                if (t[0]) {
                    status = t[0].refinement != null ? 'not_refined' : 'not_valid';
                    yield [t[0], undefined];
                }
                else if (coerce) {
                    v = t[1];
                    if (k === undefined) {
                        value = v;
                    }
                    else if (value instanceof Map) {
                        value.set(k, v);
                    }
                    else if (value instanceof Set) {
                        value.add(v);
                    }
                    else if (isObject(value)) {
                        if (v !== undefined || k in value)
                            value[k] = v;
                    }
                }
            }
        }
        if (status !== 'not_valid') {
            for (const failure of struct.refiner(value, ctx)) {
                failure.explanation = options.message;
                status = 'not_refined';
                yield [failure, undefined];
            }
        }
        if (status === 'valid') {
            yield [undefined, value];
        }
    }

    /**
     * `Struct` objects encapsulate the validation logic for a specific type of
     * values. Once constructed, you use the `assert`, `is` or `validate` helpers to
     * validate unknown input data against the struct.
     */
    class Struct {
        constructor(props) {
            const { type, schema, validator, refiner, coercer = (value) => value, entries = function* () { }, } = props;
            this.type = type;
            this.schema = schema;
            this.entries = entries;
            this.coercer = coercer;
            if (validator) {
                this.validator = (value, context) => {
                    const result = validator(value, context);
                    return toFailures(result, context, this, value);
                };
            }
            else {
                this.validator = () => [];
            }
            if (refiner) {
                this.refiner = (value, context) => {
                    const result = refiner(value, context);
                    return toFailures(result, context, this, value);
                };
            }
            else {
                this.refiner = () => [];
            }
        }
        /**
         * Assert that a value passes the struct's validation, throwing if it doesn't.
         */
        assert(value, message) {
            return assert(value, this, message);
        }
        /**
         * Create a value with the struct's coercion logic, then validate it.
         */
        create(value, message) {
            return create$1(value, this, message);
        }
        /**
         * Check if a value passes the struct's validation.
         */
        is(value) {
            return is(value, this);
        }
        /**
         * Mask a value, coercing and validating it, but returning only the subset of
         * properties defined by the struct's schema.
         */
        mask(value, message) {
            return mask(value, this, message);
        }
        /**
         * Validate a value with the struct's validation logic, returning a tuple
         * representing the result.
         *
         * You may optionally pass `true` for the `withCoercion` argument to coerce
         * the value before attempting to validate it. If you do, the result will
         * contain the coerced result when successful.
         */
        validate(value, options = {}) {
            return validate(value, this, options);
        }
    }
    /**
     * Assert that a value passes a struct, throwing if it doesn't.
     */
    function assert(value, struct, message) {
        const result = validate(value, struct, { message });
        if (result[0]) {
            throw result[0];
        }
    }
    /**
     * Create a value with the coercion logic of struct and validate it.
     */
    function create$1(value, struct, message) {
        const result = validate(value, struct, { coerce: true, message });
        if (result[0]) {
            throw result[0];
        }
        else {
            return result[1];
        }
    }
    /**
     * Mask a value, returning only the subset of properties defined by a struct.
     */
    function mask(value, struct, message) {
        const result = validate(value, struct, { coerce: true, mask: true, message });
        if (result[0]) {
            throw result[0];
        }
        else {
            return result[1];
        }
    }
    /**
     * Check if a value passes a struct.
     */
    function is(value, struct) {
        const result = validate(value, struct);
        return !result[0];
    }
    /**
     * Validate a value against a struct, returning an error if invalid, or the
     * value (with potential coercion) if valid.
     */
    function validate(value, struct, options = {}) {
        const tuples = run(value, struct, options);
        const tuple = shiftIterator(tuples);
        if (tuple[0]) {
            const error = new StructError(tuple[0], function* () {
                for (const t of tuples) {
                    if (t[0]) {
                        yield t[0];
                    }
                }
            });
            return [error, undefined];
        }
        else {
            const v = tuple[1];
            return [undefined, v];
        }
    }
    /**
     * Define a new struct type with a custom validation function.
     */
    function define(name, validator) {
        return new Struct({ type: name, schema: null, validator });
    }

    /**
     * Ensure that any value passes validation.
     */
    function any() {
        return define('any', () => true);
    }
    function array(Element) {
        return new Struct({
            type: 'array',
            schema: Element,
            *entries(value) {
                if (Element && Array.isArray(value)) {
                    for (const [i, v] of value.entries()) {
                        yield [i, v, Element];
                    }
                }
            },
            coercer(value) {
                return Array.isArray(value) ? value.slice() : value;
            },
            validator(value) {
                return (Array.isArray(value) ||
                    `Expected an array value, but received: ${print(value)}`);
            },
        });
    }
    /**
     * Ensure that a value is a bigint.
     */
    function bigint() {
        return define('bigint', (value) => {
            return typeof value === 'bigint';
        });
    }
    /**
     * Ensure that a value is a boolean.
     */
    function boolean() {
        return define('boolean', (value) => {
            return typeof value === 'boolean';
        });
    }
    /**
     * Ensure that a value is an integer.
     */
    function integer() {
        return define('integer', (value) => {
            return ((typeof value === 'number' && !isNaN(value) && Number.isInteger(value)) ||
                `Expected an integer, but received: ${print(value)}`);
        });
    }
    function literal(constant) {
        const description = print(constant);
        const t = typeof constant;
        return new Struct({
            type: 'literal',
            schema: t === 'string' || t === 'number' || t === 'boolean' ? constant : null,
            validator(value) {
                return (value === constant ||
                    `Expected the literal \`${description}\`, but received: ${print(value)}`);
            },
        });
    }
    /**
     * Ensure that no value ever passes validation.
     */
    function never() {
        return define('never', () => false);
    }
    /**
     * Augment an existing struct to allow `null` values.
     */
    function nullable(struct) {
        return new Struct({
            ...struct,
            validator: (value, ctx) => value === null || struct.validator(value, ctx),
            refiner: (value, ctx) => value === null || struct.refiner(value, ctx),
        });
    }
    /**
     * Ensure that a value is a number.
     */
    function number() {
        return define('number', (value) => {
            return ((typeof value === 'number' && !isNaN(value)) ||
                `Expected a number, but received: ${print(value)}`);
        });
    }
    function object(schema) {
        const knowns = schema ? Object.keys(schema) : [];
        const Never = never();
        return new Struct({
            type: 'object',
            schema: schema ? schema : null,
            *entries(value) {
                if (schema && isObject(value)) {
                    const unknowns = new Set(Object.keys(value));
                    for (const key of knowns) {
                        unknowns.delete(key);
                        yield [key, value[key], schema[key]];
                    }
                    for (const key of unknowns) {
                        yield [key, value[key], Never];
                    }
                }
            },
            validator(value) {
                return (isObject(value) || `Expected an object, but received: ${print(value)}`);
            },
            coercer(value) {
                return isObject(value) ? { ...value } : value;
            },
        });
    }
    /**
     * Augment a struct to allow `undefined` values.
     */
    function optional(struct) {
        return new Struct({
            ...struct,
            validator: (value, ctx) => value === undefined || struct.validator(value, ctx),
            refiner: (value, ctx) => value === undefined || struct.refiner(value, ctx),
        });
    }
    /**
     * Ensure that a value is an object with keys and values of specific types, but
     * without ensuring any specific shape of properties.
     *
     * Like TypeScript's `Record` utility.
     */
    function record(Key, Value) {
        return new Struct({
            type: 'record',
            schema: null,
            *entries(value) {
                if (isObject(value)) {
                    for (const k in value) {
                        const v = value[k];
                        yield [k, k, Key];
                        yield [k, v, Value];
                    }
                }
            },
            validator(value) {
                return (isObject(value) || `Expected an object, but received: ${print(value)}`);
            },
        });
    }
    /**
     * Ensure that a value is a string.
     */
    function string() {
        return define('string', (value) => {
            return (typeof value === 'string' ||
                `Expected a string, but received: ${print(value)}`);
        });
    }
    /**
     * Ensure that a value matches one of a set of types.
     */
    function union(Structs) {
        const description = Structs.map((s) => s.type).join(' | ');
        return new Struct({
            type: 'union',
            schema: null,
            coercer(value) {
                for (const S of Structs) {
                    const [error, coerced] = S.validate(value, { coerce: true });
                    if (!error) {
                        return coerced;
                    }
                }
                return value;
            },
            validator(value, ctx) {
                const failures = [];
                for (const S of Structs) {
                    const [...tuples] = run(value, S, ctx);
                    const [first] = tuples;
                    if (!first[0]) {
                        return [];
                    }
                    else {
                        for (const [failure] of tuples) {
                            if (failure) {
                                failures.push(failure);
                            }
                        }
                    }
                }
                return [
                    `Expected the value to satisfy a union of \`${description}\`, but received: ${print(value)}`,
                    ...failures,
                ];
            },
        });
    }
    /**
     * Ensure that any value passes validation, without widening its type to `any`.
     */
    function unknown() {
        return define('unknown', () => true);
    }

    const SUI_NS_NAME_REGEX = /^(?:[a-z0-9][a-z0-9-]{0,62}(?:\.[a-z0-9][a-z0-9-]{0,62})*)?@[a-z0-9][a-z0-9-]{0,62}$/i;
    const SUI_NS_DOMAIN_REGEX = /^(?:[a-z0-9][a-z0-9-]{0,62}\.)+sui$/i;
    function normalizeSuiNSName(name, format = "at") {
      const lowerCase = name.toLowerCase();
      let parts;
      if (lowerCase.includes("@")) {
        if (!SUI_NS_NAME_REGEX.test(lowerCase)) {
          throw new Error(`Invalid SuiNS name ${name}`);
        }
        const [labels, domain] = lowerCase.split("@");
        parts = [...labels ? labels.split(".") : [], domain];
      } else {
        if (!SUI_NS_DOMAIN_REGEX.test(lowerCase)) {
          throw new Error(`Invalid SuiNS name ${name}`);
        }
        parts = lowerCase.split(".").slice(0, -1);
      }
      if (format === "dot") {
        return `${parts.join(".")}.sui`;
      }
      return `${parts.slice(0, -1).join(".")}@${parts[parts.length - 1]}`;
    }

    BigInt(1e9);
    const MOVE_STDLIB_ADDRESS = "0x1";
    const SUI_FRAMEWORK_ADDRESS = "0x2";
    normalizeSuiObjectId("0x6");
    const SUI_TYPE_ARG = `${SUI_FRAMEWORK_ADDRESS}::sui::SUI`;
    normalizeSuiObjectId("0x5");

    const SuiObjectRef = object({
      /** Base64 string representing the object digest */
      digest: string(),
      /** Hex code as string representing the object id */
      objectId: string(),
      /** Object version */
      version: union([number(), string(), bigint()])
    });
    const ObjectArg = union([
      object({ ImmOrOwned: SuiObjectRef }),
      object({
        Shared: object({
          objectId: string(),
          initialSharedVersion: union([integer(), string()]),
          mutable: boolean()
        })
      }),
      object({ Receiving: SuiObjectRef })
    ]);
    const PureCallArg = object({ Pure: array(integer()) });
    const ObjectCallArg = object({ Object: ObjectArg });
    const BuilderCallArg = union([PureCallArg, ObjectCallArg]);
    function Pure(data, type) {
      return {
        Pure: Array.from(
          data instanceof Uint8Array ? data : isSerializedBcs(data) ? data.toBytes() : (
            // NOTE: We explicitly set this to be growable to infinity, because we have maxSize validation at the builder-level:
            suiBcs.ser(type, data, { maxSize: Infinity }).toBytes()
          )
        )
      };
    }
    const Inputs = {
      Pure,
      ObjectRef({ objectId, digest, version }) {
        return {
          Object: {
            ImmOrOwned: {
              digest,
              version,
              objectId: normalizeSuiAddress(objectId)
            }
          }
        };
      },
      SharedObjectRef({ objectId, mutable, initialSharedVersion }) {
        return {
          Object: {
            Shared: {
              mutable,
              initialSharedVersion,
              objectId: normalizeSuiAddress(objectId)
            }
          }
        };
      },
      ReceivingRef({ objectId, digest, version }) {
        return {
          Object: {
            Receiving: {
              digest,
              version,
              objectId: normalizeSuiAddress(objectId)
            }
          }
        };
      }
    };
    function getIdFromCallArg(arg) {
      if (typeof arg === "string") {
        return normalizeSuiAddress(arg);
      }
      if ("ImmOrOwned" in arg.Object) {
        return normalizeSuiAddress(arg.Object.ImmOrOwned.objectId);
      }
      if ("Receiving" in arg.Object) {
        return normalizeSuiAddress(arg.Object.Receiving.objectId);
      }
      return normalizeSuiAddress(arg.Object.Shared.objectId);
    }
    function getSharedObjectInput(arg) {
      return typeof arg === "object" && "Object" in arg && "Shared" in arg.Object ? arg.Object.Shared : void 0;
    }
    function isMutableSharedObjectInput(arg) {
      return getSharedObjectInput(arg)?.mutable ?? false;
    }

    function createPure(makePure) {
      function pure(value, type) {
        return makePure(value, type);
      }
      pure.u8 = (value) => makePure(suiBcs.U8.serialize(value));
      pure.u16 = (value) => makePure(suiBcs.U16.serialize(value));
      pure.u32 = (value) => makePure(suiBcs.U32.serialize(value));
      pure.u64 = (value) => makePure(suiBcs.U64.serialize(value));
      pure.u128 = (value) => makePure(suiBcs.U128.serialize(value));
      pure.u256 = (value) => makePure(suiBcs.U256.serialize(value));
      pure.bool = (value) => makePure(suiBcs.Bool.serialize(value));
      pure.string = (value) => makePure(suiBcs.String.serialize(value));
      pure.address = (value) => makePure(suiBcs.Address.serialize(value));
      pure.id = pure.address;
      return pure;
    }

    function create(value, struct) {
      return create$1(value, struct);
    }
    function extractMutableReference(normalizedType) {
      return typeof normalizedType === "object" && "MutableReference" in normalizedType ? normalizedType.MutableReference : void 0;
    }
    function extractReference(normalizedType) {
      return typeof normalizedType === "object" && "Reference" in normalizedType ? normalizedType.Reference : void 0;
    }
    function extractStructTag(normalizedType) {
      if (typeof normalizedType === "object" && "Struct" in normalizedType) {
        return normalizedType;
      }
      const ref = extractReference(normalizedType);
      const mutRef = extractMutableReference(normalizedType);
      if (typeof ref === "object" && "Struct" in ref) {
        return ref;
      }
      if (typeof mutRef === "object" && "Struct" in mutRef) {
        return mutRef;
      }
      return void 0;
    }

    const OBJECT_MODULE_NAME = "object";
    const ID_STRUCT_NAME = "ID";
    const STD_ASCII_MODULE_NAME = "ascii";
    const STD_ASCII_STRUCT_NAME = "String";
    const STD_UTF8_MODULE_NAME = "string";
    const STD_UTF8_STRUCT_NAME = "String";
    const STD_OPTION_MODULE_NAME = "option";
    const STD_OPTION_STRUCT_NAME = "Option";
    const RESOLVED_SUI_ID = {
      address: SUI_FRAMEWORK_ADDRESS,
      module: OBJECT_MODULE_NAME,
      name: ID_STRUCT_NAME
    };
    const RESOLVED_ASCII_STR = {
      address: MOVE_STDLIB_ADDRESS,
      module: STD_ASCII_MODULE_NAME,
      name: STD_ASCII_STRUCT_NAME
    };
    const RESOLVED_UTF8_STR = {
      address: MOVE_STDLIB_ADDRESS,
      module: STD_UTF8_MODULE_NAME,
      name: STD_UTF8_STRUCT_NAME
    };
    const RESOLVED_STD_OPTION = {
      address: MOVE_STDLIB_ADDRESS,
      module: STD_OPTION_MODULE_NAME,
      name: STD_OPTION_STRUCT_NAME
    };
    const isSameStruct = (a, b) => a.address === b.address && a.module === b.module && a.name === b.name;
    function isTxContext(param) {
      const struct = extractStructTag(param)?.Struct;
      return struct?.address === "0x2" && struct?.module === "tx_context" && struct?.name === "TxContext";
    }
    function expectType(typeName, argVal) {
      if (typeof argVal === "undefined") {
        return;
      }
      if (typeof argVal !== typeName) {
        throw new Error(`Expect ${argVal} to be ${typeName}, received ${typeof argVal}`);
      }
    }
    const allowedTypes = ["Address", "Bool", "U8", "U16", "U32", "U64", "U128", "U256"];
    function getPureSerializationType(normalizedType, argVal) {
      if (typeof normalizedType === "string" && allowedTypes.includes(normalizedType)) {
        if (normalizedType in ["U8", "U16", "U32", "U64", "U128", "U256"]) {
          expectType("number", argVal);
        } else if (normalizedType === "Bool") {
          expectType("boolean", argVal);
        } else if (normalizedType === "Address") {
          expectType("string", argVal);
          if (argVal && !isValidSuiAddress(argVal)) {
            throw new Error("Invalid Sui Address");
          }
        }
        return normalizedType.toLowerCase();
      } else if (typeof normalizedType === "string") {
        throw new Error(`Unknown pure normalized type ${JSON.stringify(normalizedType, null, 2)}`);
      }
      if ("Vector" in normalizedType) {
        if ((argVal === void 0 || typeof argVal === "string") && normalizedType.Vector === "U8") {
          return "string";
        }
        if (argVal !== void 0 && !Array.isArray(argVal)) {
          throw new Error(`Expect ${argVal} to be a array, received ${typeof argVal}`);
        }
        const innerType = getPureSerializationType(
          normalizedType.Vector,
          // undefined when argVal is empty
          argVal ? argVal[0] : void 0
        );
        if (innerType === void 0) {
          return;
        }
        return `vector<${innerType}>`;
      }
      if ("Struct" in normalizedType) {
        if (isSameStruct(normalizedType.Struct, RESOLVED_ASCII_STR)) {
          return "string";
        } else if (isSameStruct(normalizedType.Struct, RESOLVED_UTF8_STR)) {
          return "utf8string";
        } else if (isSameStruct(normalizedType.Struct, RESOLVED_SUI_ID)) {
          return "address";
        } else if (isSameStruct(normalizedType.Struct, RESOLVED_STD_OPTION)) {
          const optionToVec = {
            Vector: normalizedType.Struct.typeArguments[0]
          };
          return getPureSerializationType(optionToVec, argVal);
        }
      }
      return void 0;
    }

    function hashTypedData(typeTag, data) {
      const typeTagBytes = Array.from(`${typeTag}::`).map((e) => e.charCodeAt(0));
      const dataWithTag = new Uint8Array(typeTagBytes.length + data.length);
      dataWithTag.set(typeTagBytes);
      dataWithTag.set(data, typeTagBytes.length);
      return blake2b(dataWithTag, { dkLen: 32 });
    }

    const option = (some) => union([object({ None: union([literal(true), literal(null)]) }), object({ Some: some })]);
    const TransactionBlockInput = union([
      object({
        kind: literal("Input"),
        index: integer(),
        value: optional(any()),
        type: optional(literal("object"))
      }),
      object({
        kind: literal("Input"),
        index: integer(),
        value: optional(any()),
        type: literal("pure")
      })
    ]);
    const TransactionArgumentTypes = [
      TransactionBlockInput,
      object({ kind: literal("GasCoin") }),
      object({ kind: literal("Result"), index: integer() }),
      object({
        kind: literal("NestedResult"),
        index: integer(),
        resultIndex: integer()
      })
    ];
    const TransactionArgument = union([...TransactionArgumentTypes]);
    const MoveCallTransaction = object({
      kind: literal("MoveCall"),
      target: define("target", string().validator),
      typeArguments: array(string()),
      arguments: array(TransactionArgument)
    });
    const TransferObjectsTransaction = object({
      kind: literal("TransferObjects"),
      objects: array(TransactionArgument),
      address: TransactionArgument
    });
    const SplitCoinsTransaction = object({
      kind: literal("SplitCoins"),
      coin: TransactionArgument,
      amounts: array(TransactionArgument)
    });
    const MergeCoinsTransaction = object({
      kind: literal("MergeCoins"),
      destination: TransactionArgument,
      sources: array(TransactionArgument)
    });
    const MakeMoveVecTransaction = object({
      kind: literal("MakeMoveVec"),
      // TODO: ideally we should use `TypeTag` instead of `record()` here,
      // but TypeTag is recursively defined and it's tricky to define a
      // recursive struct in superstruct
      type: optional(option(record(string(), unknown()))),
      objects: array(TransactionArgument)
    });
    const PublishTransaction = object({
      kind: literal("Publish"),
      modules: array(array(integer())),
      dependencies: array(string())
    });
    const UpgradeTransaction = object({
      kind: literal("Upgrade"),
      modules: array(array(integer())),
      dependencies: array(string()),
      packageId: string(),
      ticket: TransactionArgument
    });
    const TransactionTypes = [
      MoveCallTransaction,
      TransferObjectsTransaction,
      SplitCoinsTransaction,
      MergeCoinsTransaction,
      PublishTransaction,
      UpgradeTransaction,
      MakeMoveVecTransaction
    ];
    const TransactionType = union([...TransactionTypes]);
    const Transactions = {
      MoveCall(input) {
        return create(
          {
            kind: "MoveCall",
            target: input.target,
            arguments: input.arguments ?? [],
            typeArguments: input.typeArguments ?? []
          },
          MoveCallTransaction
        );
      },
      TransferObjects(objects, address) {
        if (address.kind === "Input" && address.type === "pure" && typeof address.value !== "object") {
          address.value = Inputs.Pure(suiBcs.Address.serialize(address.value));
        }
        return create({ kind: "TransferObjects", objects, address }, TransferObjectsTransaction);
      },
      SplitCoins(coin, amounts) {
        amounts.forEach((input) => {
          if (input.kind === "Input" && input.type === "pure" && typeof input.value !== "object") {
            input.value = Inputs.Pure(suiBcs.U64.serialize(input.value));
          }
        });
        return create(
          {
            kind: "SplitCoins",
            coin,
            amounts
          },
          SplitCoinsTransaction
        );
      },
      MergeCoins(destination, sources) {
        return create({ kind: "MergeCoins", destination, sources }, MergeCoinsTransaction);
      },
      Publish({
        modules,
        dependencies
      }) {
        return create(
          {
            kind: "Publish",
            modules: modules.map(
              (module) => typeof module === "string" ? Array.from(fromB64(module)) : module
            ),
            dependencies: dependencies.map((dep) => normalizeSuiObjectId(dep))
          },
          PublishTransaction
        );
      },
      Upgrade({
        modules,
        dependencies,
        packageId,
        ticket
      }) {
        return create(
          {
            kind: "Upgrade",
            modules: modules.map(
              (module) => typeof module === "string" ? Array.from(fromB64(module)) : module
            ),
            dependencies: dependencies.map((dep) => normalizeSuiObjectId(dep)),
            packageId,
            ticket
          },
          UpgradeTransaction
        );
      },
      MakeMoveVec({
        type,
        objects
      }) {
        return create(
          {
            kind: "MakeMoveVec",
            type: type ? { Some: TypeTagSerializer.parseFromStr(type) } : { None: null },
            objects
          },
          MakeMoveVecTransaction
        );
      }
    };

    const TransactionExpiration = optional(
      nullable(
        union([object({ Epoch: integer() }), object({ None: union([literal(true), literal(null)]) })])
      )
    );
    const StringEncodedBigint = define("StringEncodedBigint", (val) => {
      if (!["string", "number", "bigint"].includes(typeof val))
        return false;
      try {
        BigInt(val);
        return true;
      } catch {
        return false;
      }
    });
    const GasConfig = object({
      budget: optional(StringEncodedBigint),
      price: optional(StringEncodedBigint),
      payment: optional(array(SuiObjectRef)),
      owner: optional(string())
    });
    const SerializedTransactionDataBuilder = object({
      version: literal(1),
      sender: optional(string()),
      expiration: TransactionExpiration,
      gasConfig: GasConfig,
      inputs: array(TransactionBlockInput),
      transactions: array(TransactionType)
    });
    function prepareSuiAddress(address) {
      return normalizeSuiAddress(address).replace("0x", "");
    }
    class TransactionBlockDataBuilder {
      constructor(clone) {
        this.version = 1;
        this.sender = clone?.sender;
        this.expiration = clone?.expiration;
        this.gasConfig = clone?.gasConfig ?? {};
        this.inputs = clone?.inputs ?? [];
        this.transactions = clone?.transactions ?? [];
      }
      static fromKindBytes(bytes) {
        const kind = suiBcs.TransactionKind.parse(bytes);
        const programmableTx = "ProgrammableTransaction" in kind ? kind.ProgrammableTransaction : null;
        if (!programmableTx) {
          throw new Error("Unable to deserialize from bytes.");
        }
        const serialized = create(
          {
            version: 1,
            gasConfig: {},
            inputs: programmableTx.inputs.map(
              (value, index) => create(
                {
                  kind: "Input",
                  value,
                  index,
                  type: is(value, PureCallArg) ? "pure" : "object"
                },
                TransactionBlockInput
              )
            ),
            transactions: programmableTx.transactions
          },
          SerializedTransactionDataBuilder
        );
        return TransactionBlockDataBuilder.restore(serialized);
      }
      static fromBytes(bytes) {
        const rawData = suiBcs.TransactionData.parse(bytes);
        const data = rawData?.V1;
        const programmableTx = "ProgrammableTransaction" in data.kind ? data?.kind?.ProgrammableTransaction : null;
        if (!data || !programmableTx) {
          throw new Error("Unable to deserialize from bytes.");
        }
        const serialized = create(
          {
            version: 1,
            sender: data.sender,
            expiration: data.expiration,
            gasConfig: data.gasData,
            inputs: programmableTx.inputs.map(
              (value, index) => create(
                {
                  kind: "Input",
                  value,
                  index,
                  type: is(value, PureCallArg) ? "pure" : "object"
                },
                TransactionBlockInput
              )
            ),
            transactions: programmableTx.transactions
          },
          SerializedTransactionDataBuilder
        );
        return TransactionBlockDataBuilder.restore(serialized);
      }
      static restore(data) {
        assert(data, SerializedTransactionDataBuilder);
        const transactionData = new TransactionBlockDataBuilder();
        Object.assign(transactionData, data);
        return transactionData;
      }
      /**
       * Generate transaction digest.
       *
       * @param bytes BCS serialized transaction data
       * @returns transaction digest.
       */
      static getDigestFromBytes(bytes) {
        const hash = hashTypedData("TransactionData", bytes);
        return toB58(hash);
      }
      build({
        maxSizeBytes = Infinity,
        overrides,
        onlyTransactionKind
      } = {}) {
        const inputs = this.inputs.map((input) => {
          assert(input.value, BuilderCallArg);
          return input.value;
        });
        const kind = {
          ProgrammableTransaction: {
            inputs,
            transactions: this.transactions
          }
        };
        if (onlyTransactionKind) {
          return suiBcs.TransactionKind.serialize(kind, { maxSize: maxSizeBytes }).toBytes();
        }
        const expiration = overrides?.expiration ?? this.expiration;
        const sender = overrides?.sender ?? this.sender;
        const gasConfig = { ...this.gasConfig, ...overrides?.gasConfig };
        if (!sender) {
          throw new Error("Missing transaction sender");
        }
        if (!gasConfig.budget) {
          throw new Error("Missing gas budget");
        }
        if (!gasConfig.payment) {
          throw new Error("Missing gas payment");
        }
        if (!gasConfig.price) {
          throw new Error("Missing gas price");
        }
        const transactionData = {
          sender: prepareSuiAddress(sender),
          expiration: expiration ? expiration : { None: true },
          gasData: {
            payment: gasConfig.payment,
            owner: prepareSuiAddress(this.gasConfig.owner ?? sender),
            price: BigInt(gasConfig.price),
            budget: BigInt(gasConfig.budget)
          },
          kind: {
            ProgrammableTransaction: {
              inputs,
              transactions: this.transactions
            }
          }
        };
        return suiBcs.TransactionData.serialize(
          { V1: transactionData },
          { maxSize: maxSizeBytes }
        ).toBytes();
      }
      getDigest() {
        const bytes = this.build({ onlyTransactionKind: false });
        return TransactionBlockDataBuilder.getDigestFromBytes(bytes);
      }
      snapshot() {
        return create(this, SerializedTransactionDataBuilder);
      }
    }

    var __accessCheck = (obj, member, msg) => {
      if (!member.has(obj))
        throw TypeError("Cannot " + msg);
    };
    var __privateGet = (obj, member, getter) => {
      __accessCheck(obj, member, "read from private field");
      return getter ? getter.call(obj) : member.get(obj);
    };
    var __privateAdd = (obj, member, value) => {
      if (member.has(obj))
        throw TypeError("Cannot add the same private member more than once");
      member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
    };
    var __privateSet = (obj, member, value, setter) => {
      __accessCheck(obj, member, "write to private field");
      setter ? setter.call(obj, value) : member.set(obj, value);
      return value;
    };
    var __privateMethod = (obj, member, method) => {
      __accessCheck(obj, member, "access private method");
      return method;
    };
    var _blockData, _input, input_fn, _normalizeTransactionArgument, normalizeTransactionArgument_fn, _getConfig, getConfig_fn, _validate, validate_fn, _prepareGasPayment, prepareGasPayment_fn, _prepareGasPrice, prepareGasPrice_fn, _prepareTransactions, prepareTransactions_fn, _prepare, prepare_fn;
    const DefaultOfflineLimits = {
      maxPureArgumentSize: 16 * 1024,
      maxTxGas: 5e10,
      maxGasObjects: 256,
      maxTxSizeBytes: 128 * 1024
    };
    function createTransactionResult(index) {
      const baseResult = { kind: "Result", index };
      const nestedResults = [];
      const nestedResultFor = (resultIndex) => nestedResults[resultIndex] ?? (nestedResults[resultIndex] = {
        kind: "NestedResult",
        index,
        resultIndex
      });
      return new Proxy(baseResult, {
        set() {
          throw new Error(
            "The transaction result is a proxy, and does not support setting properties directly"
          );
        },
        // TODO: Instead of making this return a concrete argument, we should ideally
        // make it reference-based (so that this gets resolved at build-time), which
        // allows re-ordering transactions.
        get(target, property) {
          if (property in target) {
            return Reflect.get(target, property);
          }
          if (property === Symbol.iterator) {
            return function* () {
              let i = 0;
              while (true) {
                yield nestedResultFor(i);
                i++;
              }
            };
          }
          if (typeof property === "symbol")
            return;
          const resultIndex = parseInt(property, 10);
          if (Number.isNaN(resultIndex) || resultIndex < 0)
            return;
          return nestedResultFor(resultIndex);
        }
      });
    }
    function isReceivingType(normalizedType) {
      const tag = extractStructTag(normalizedType);
      if (tag) {
        return tag.Struct.address === "0x2" && tag.Struct.module === "transfer" && tag.Struct.name === "Receiving";
      }
      return false;
    }
    function expectClient(options) {
      if (!options.client) {
        throw new Error(
          `No provider passed to Transaction#build, but transaction data was not sufficient to build offline.`
        );
      }
      return options.client;
    }
    const TRANSACTION_BRAND = Symbol.for("@mysten/transaction");
    const LIMITS = {
      // The maximum gas that is allowed.
      maxTxGas: "max_tx_gas",
      // The maximum number of gas objects that can be selected for one transaction.
      maxGasObjects: "max_gas_payment_objects",
      // The maximum size (in bytes) that the transaction can be:
      maxTxSizeBytes: "max_tx_size_bytes",
      // The maximum size (in bytes) that pure arguments can be:
      maxPureArgumentSize: "max_pure_argument_size"
    };
    const GAS_SAFE_OVERHEAD = 1000n;
    const MAX_OBJECTS_PER_FETCH = 50;
    const chunk = (arr, size) => Array.from(
      { length: Math.ceil(arr.length / size) },
      (_, i) => arr.slice(i * size, i * size + size)
    );
    function isTransactionBlock(obj) {
      return !!obj && typeof obj === "object" && obj[TRANSACTION_BRAND] === true;
    }
    const _TransactionBlock = class {
      constructor(transaction) {
        /**
         * Dynamically create a new input, which is separate from the `input`. This is important
         * for generated clients to be able to define unique inputs that are non-overlapping with the
         * defined inputs.
         *
         * For `Uint8Array` type automatically convert the input into a `Pure` CallArg, since this
         * is the format required for custom serialization.
         *
         */
        __privateAdd(this, _input);
        __privateAdd(this, _normalizeTransactionArgument);
        __privateAdd(this, _getConfig);
        __privateAdd(this, _validate);
        // The current default is just picking _all_ coins we can which may not be ideal.
        __privateAdd(this, _prepareGasPayment);
        __privateAdd(this, _prepareGasPrice);
        __privateAdd(this, _prepareTransactions);
        /**
         * Prepare the transaction by valdiating the transaction data and resolving all inputs
         * so that it can be built into bytes.
         */
        __privateAdd(this, _prepare);
        __privateAdd(this, _blockData, void 0);
        __privateSet(this, _blockData, new TransactionBlockDataBuilder(
          transaction ? transaction.blockData : void 0
        ));
      }
      /**
       * Converts from a serialize transaction kind (built with `build({ onlyTransactionKind: true })`) to a `Transaction` class.
       * Supports either a byte array, or base64-encoded bytes.
       */
      static fromKind(serialized) {
        const tx = new _TransactionBlock();
        __privateSet(tx, _blockData, TransactionBlockDataBuilder.fromKindBytes(
          typeof serialized === "string" ? fromB64(serialized) : serialized
        ));
        return tx;
      }
      /**
       * Converts from a serialized transaction format to a `Transaction` class.
       * There are two supported serialized formats:
       * - A string returned from `Transaction#serialize`. The serialized format must be compatible, or it will throw an error.
       * - A byte array (or base64-encoded bytes) containing BCS transaction data.
       */
      static from(serialized) {
        const tx = new _TransactionBlock();
        if (typeof serialized !== "string" || !serialized.startsWith("{")) {
          __privateSet(tx, _blockData, TransactionBlockDataBuilder.fromBytes(
            typeof serialized === "string" ? fromB64(serialized) : serialized
          ));
        } else {
          __privateSet(tx, _blockData, TransactionBlockDataBuilder.restore(JSON.parse(serialized)));
        }
        return tx;
      }
      setSender(sender) {
        __privateGet(this, _blockData).sender = sender;
      }
      /**
       * Sets the sender only if it has not already been set.
       * This is useful for sponsored transaction flows where the sender may not be the same as the signer address.
       */
      setSenderIfNotSet(sender) {
        if (!__privateGet(this, _blockData).sender) {
          __privateGet(this, _blockData).sender = sender;
        }
      }
      setExpiration(expiration) {
        __privateGet(this, _blockData).expiration = expiration;
      }
      setGasPrice(price) {
        __privateGet(this, _blockData).gasConfig.price = String(price);
      }
      setGasBudget(budget) {
        __privateGet(this, _blockData).gasConfig.budget = String(budget);
      }
      setGasOwner(owner) {
        __privateGet(this, _blockData).gasConfig.owner = owner;
      }
      setGasPayment(payments) {
        __privateGet(this, _blockData).gasConfig.payment = payments.map((payment) => mask(payment, SuiObjectRef));
      }
      /** Get a snapshot of the transaction data, in JSON form: */
      get blockData() {
        return __privateGet(this, _blockData).snapshot();
      }
      // Used to brand transaction classes so that they can be identified, even between multiple copies
      // of the builder.
      get [TRANSACTION_BRAND]() {
        return true;
      }
      // Temporary workaround for the wallet interface accidentally serializing transaction blocks via postMessage
      get pure() {
        Object.defineProperty(this, "pure", {
          enumerable: false,
          value: createPure((value, type) => {
            if (isSerializedBcs(value)) {
              return __privateMethod(this, _input, input_fn).call(this, "pure", {
                Pure: Array.from(value.toBytes())
              });
            }
            return __privateMethod(this, _input, input_fn).call(this, "pure", value instanceof Uint8Array ? Inputs.Pure(value) : type ? Inputs.Pure(value, type) : value);
          })
        });
        return this.pure;
      }
      /** Returns an argument for the gas coin, to be used in a transaction. */
      get gas() {
        return { kind: "GasCoin" };
      }
      /**
       * Add a new object input to the transaction.
       */
      object(value) {
        if (typeof value === "object" && "kind" in value) {
          return value;
        }
        const id = getIdFromCallArg(value);
        const inserted = __privateGet(this, _blockData).inputs.find(
          (i) => i.type === "object" && id === getIdFromCallArg(i.value)
        );
        if (inserted && is(inserted.value, ObjectCallArg) && "Shared" in inserted.value.Object && is(value, ObjectCallArg) && "Shared" in value.Object) {
          inserted.value.Object.Shared.mutable = inserted.value.Object.Shared.mutable || value.Object.Shared.mutable;
        }
        return inserted ?? __privateMethod(this, _input, input_fn).call(this, "object", typeof value === "string" ? normalizeSuiAddress(value) : value);
      }
      /**
       * Add a new object input to the transaction using the fully-resolved object reference.
       * If you only have an object ID, use `builder.object(id)` instead.
       */
      objectRef(...args) {
        return this.object(Inputs.ObjectRef(...args));
      }
      /**
       * Add a new receiving input to the transaction using the fully-resolved object reference.
       * If you only have an object ID, use `builder.object(id)` instead.
       */
      receivingRef(...args) {
        return this.object(Inputs.ReceivingRef(...args));
      }
      /**
       * Add a new shared object input to the transaction using the fully-resolved shared object reference.
       * If you only have an object ID, use `builder.object(id)` instead.
       */
      sharedObjectRef(...args) {
        return this.object(Inputs.SharedObjectRef(...args));
      }
      /** Add a transaction to the transaction block. */
      add(transaction) {
        const index = __privateGet(this, _blockData).transactions.push(transaction);
        return createTransactionResult(index - 1);
      }
      // Method shorthands:
      splitCoins(coin, amounts) {
        return this.add(
          Transactions.SplitCoins(
            typeof coin === "string" ? this.object(coin) : coin,
            amounts.map(
              (amount) => typeof amount === "number" || typeof amount === "bigint" || typeof amount === "string" ? this.pure.u64(amount) : __privateMethod(this, _normalizeTransactionArgument, normalizeTransactionArgument_fn).call(this, amount)
            )
          )
        );
      }
      mergeCoins(destination, sources) {
        return this.add(
          Transactions.MergeCoins(
            typeof destination === "string" ? this.object(destination) : destination,
            sources.map((src) => typeof src === "string" ? this.object(src) : src)
          )
        );
      }
      publish({ modules, dependencies }) {
        return this.add(
          Transactions.Publish({
            modules,
            dependencies
          })
        );
      }
      upgrade({
        modules,
        dependencies,
        packageId,
        ticket
      }) {
        return this.add(
          Transactions.Upgrade({
            modules,
            dependencies,
            packageId,
            ticket: typeof ticket === "string" ? this.object(ticket) : ticket
          })
        );
      }
      moveCall({
        arguments: args,
        typeArguments,
        target
      }) {
        return this.add(
          Transactions.MoveCall({
            arguments: args?.map((arg) => __privateMethod(this, _normalizeTransactionArgument, normalizeTransactionArgument_fn).call(this, arg)),
            typeArguments,
            target
          })
        );
      }
      transferObjects(objects, address) {
        return this.add(
          Transactions.TransferObjects(
            objects.map((obj) => typeof obj === "string" ? this.object(obj) : obj),
            typeof address === "string" ? this.pure.address(address) : __privateMethod(this, _normalizeTransactionArgument, normalizeTransactionArgument_fn).call(this, address)
          )
        );
      }
      makeMoveVec({
        type,
        objects
      }) {
        return this.add(
          Transactions.MakeMoveVec({
            type,
            objects: objects.map((obj) => typeof obj === "string" ? this.object(obj) : obj)
          })
        );
      }
      /**
       * Serialize the transaction to a string so that it can be sent to a separate context.
       * This is different from `build` in that it does not serialize to BCS bytes, and instead
       * uses a separate format that is unique to the transaction builder. This allows
       * us to serialize partially-complete transactions, that can then be completed and
       * built in a separate context.
       *
       * For example, a dapp can construct a transaction, but not provide gas objects
       * or a gas budget. The transaction then can be sent to the wallet, where this
       * information is automatically filled in (e.g. by querying for coin objects
       * and performing a dry run).
       */
      serialize() {
        return JSON.stringify(__privateGet(this, _blockData).snapshot());
      }
      /** Build the transaction to BCS bytes, and sign it with the provided keypair. */
      async sign(options) {
        const { signer, ...buildOptions } = options;
        const bytes = await this.build(buildOptions);
        return signer.signTransactionBlock(bytes);
      }
      /** Build the transaction to BCS bytes. */
      async build(options = {}) {
        await __privateMethod(this, _prepare, prepare_fn).call(this, options);
        return __privateGet(this, _blockData).build({
          maxSizeBytes: __privateMethod(this, _getConfig, getConfig_fn).call(this, "maxTxSizeBytes", options),
          onlyTransactionKind: options.onlyTransactionKind
        });
      }
      /** Derive transaction digest */
      async getDigest(options = {}) {
        await __privateMethod(this, _prepare, prepare_fn).call(this, options);
        return __privateGet(this, _blockData).getDigest();
      }
    };
    let TransactionBlock = _TransactionBlock;
    _blockData = new WeakMap();
    _input = new WeakSet();
    input_fn = function(type, value) {
      const index = __privateGet(this, _blockData).inputs.length;
      const input = create(
        {
          kind: "Input",
          // bigints can't be serialized to JSON, so just string-convert them here:
          value: typeof value === "bigint" ? String(value) : value,
          index,
          type
        },
        TransactionBlockInput
      );
      __privateGet(this, _blockData).inputs.push(input);
      return input;
    };
    _normalizeTransactionArgument = new WeakSet();
    normalizeTransactionArgument_fn = function(arg) {
      if (isSerializedBcs(arg)) {
        return this.pure(arg);
      }
      return arg;
    };
    _getConfig = new WeakSet();
    getConfig_fn = function(key, { protocolConfig, limits }) {
      if (limits && typeof limits[key] === "number") {
        return limits[key];
      }
      if (!protocolConfig) {
        return DefaultOfflineLimits[key];
      }
      const attribute = protocolConfig?.attributes[LIMITS[key]];
      if (!attribute) {
        throw new Error(`Missing expected protocol config: "${LIMITS[key]}"`);
      }
      const value = "u64" in attribute ? attribute.u64 : "u32" in attribute ? attribute.u32 : attribute.f64;
      if (!value) {
        throw new Error(`Unexpected protocol config value found for: "${LIMITS[key]}"`);
      }
      return Number(value);
    };
    _validate = new WeakSet();
    validate_fn = function(options) {
      const maxPureArgumentSize = __privateMethod(this, _getConfig, getConfig_fn).call(this, "maxPureArgumentSize", options);
      __privateGet(this, _blockData).inputs.forEach((input, index) => {
        if (is(input.value, PureCallArg)) {
          if (input.value.Pure.length > maxPureArgumentSize) {
            throw new Error(
              `Input at index ${index} is too large, max pure input size is ${maxPureArgumentSize} bytes, got ${input.value.Pure.length} bytes`
            );
          }
        }
      });
    };
    _prepareGasPayment = new WeakSet();
    prepareGasPayment_fn = async function(options) {
      if (__privateGet(this, _blockData).gasConfig.payment) {
        const maxGasObjects = __privateMethod(this, _getConfig, getConfig_fn).call(this, "maxGasObjects", options);
        if (__privateGet(this, _blockData).gasConfig.payment.length > maxGasObjects) {
          throw new Error(`Payment objects exceed maximum amount: ${maxGasObjects}`);
        }
      }
      if (options.onlyTransactionKind || __privateGet(this, _blockData).gasConfig.payment) {
        return;
      }
      const gasOwner = __privateGet(this, _blockData).gasConfig.owner ?? __privateGet(this, _blockData).sender;
      const coins = await expectClient(options).getCoins({
        owner: gasOwner,
        coinType: SUI_TYPE_ARG
      });
      const paymentCoins = coins.data.filter((coin) => {
        const matchingInput = __privateGet(this, _blockData).inputs.find((input) => {
          if (is(input.value, BuilderCallArg) && "Object" in input.value && "ImmOrOwned" in input.value.Object) {
            return coin.coinObjectId === input.value.Object.ImmOrOwned.objectId;
          }
          return false;
        });
        return !matchingInput;
      }).slice(0, __privateMethod(this, _getConfig, getConfig_fn).call(this, "maxGasObjects", options) - 1).map((coin) => ({
        objectId: coin.coinObjectId,
        digest: coin.digest,
        version: coin.version
      }));
      if (!paymentCoins.length) {
        throw new Error("No valid gas coins found for the transaction.");
      }
      this.setGasPayment(paymentCoins);
    };
    _prepareGasPrice = new WeakSet();
    prepareGasPrice_fn = async function(options) {
      if (options.onlyTransactionKind || __privateGet(this, _blockData).gasConfig.price) {
        return;
      }
      this.setGasPrice(await expectClient(options).getReferenceGasPrice());
    };
    _prepareTransactions = new WeakSet();
    prepareTransactions_fn = async function(options) {
      const { inputs, transactions } = __privateGet(this, _blockData);
      const moveModulesToResolve = [];
      const objectsToResolve = [];
      inputs.forEach((input) => {
        if (input.type === "object" && typeof input.value === "string") {
          objectsToResolve.push({ id: normalizeSuiAddress(input.value), input });
          return;
        }
      });
      transactions.forEach((transaction) => {
        if (transaction.kind === "MoveCall") {
          const needsResolution = transaction.arguments.some(
            (arg) => arg.kind === "Input" && !is(inputs[arg.index].value, BuilderCallArg)
          );
          if (needsResolution) {
            moveModulesToResolve.push(transaction);
          }
        }
        if (transaction.kind === "SplitCoins") {
          transaction.amounts.forEach((amount) => {
            if (amount.kind === "Input") {
              const input = inputs[amount.index];
              if (typeof input.value !== "object") {
                input.value = Inputs.Pure(suiBcs.U64.serialize(input.value));
              }
            }
          });
        }
        if (transaction.kind === "TransferObjects") {
          if (transaction.address.kind === "Input") {
            const input = inputs[transaction.address.index];
            if (typeof input.value !== "object") {
              input.value = Inputs.Pure(suiBcs.Address.serialize(input.value));
            }
          }
        }
      });
      if (moveModulesToResolve.length) {
        await Promise.all(
          moveModulesToResolve.map(async (moveCall) => {
            const [packageId, moduleName, functionName] = moveCall.target.split("::");
            const normalized = await expectClient(options).getNormalizedMoveFunction({
              package: normalizeSuiObjectId(packageId),
              module: moduleName,
              function: functionName
            });
            const hasTxContext = normalized.parameters.length > 0 && isTxContext(normalized.parameters.at(-1));
            const params = hasTxContext ? normalized.parameters.slice(0, normalized.parameters.length - 1) : normalized.parameters;
            if (params.length !== moveCall.arguments.length) {
              throw new Error("Incorrect number of arguments.");
            }
            params.forEach((param, i) => {
              const arg = moveCall.arguments[i];
              if (arg.kind !== "Input")
                return;
              const input = inputs[arg.index];
              if (is(input.value, BuilderCallArg))
                return;
              const inputValue = input.value;
              const serType = getPureSerializationType(param, inputValue);
              if (serType) {
                input.value = Inputs.Pure(inputValue, serType);
                return;
              }
              const structVal = extractStructTag(param);
              if (structVal != null || typeof param === "object" && "TypeParameter" in param) {
                if (typeof inputValue !== "string") {
                  throw new Error(
                    `Expect the argument to be an object id string, got ${JSON.stringify(
                  inputValue,
                  null,
                  2
                )}`
                  );
                }
                objectsToResolve.push({
                  id: inputValue,
                  input,
                  normalizedType: param
                });
                return;
              }
              throw new Error(
                `Unknown call arg type ${JSON.stringify(param, null, 2)} for value ${JSON.stringify(
              inputValue,
              null,
              2
            )}`
              );
            });
          })
        );
      }
      if (objectsToResolve.length) {
        const dedupedIds = [...new Set(objectsToResolve.map(({ id }) => id))];
        const objectChunks = chunk(dedupedIds, MAX_OBJECTS_PER_FETCH);
        const objects = (await Promise.all(
          objectChunks.map(
            (chunk2) => expectClient(options).multiGetObjects({
              ids: chunk2,
              options: { showOwner: true }
            })
          )
        )).flat();
        let objectsById = new Map(
          dedupedIds.map((id, index) => {
            return [id, objects[index]];
          })
        );
        const invalidObjects = Array.from(objectsById).filter(([_, obj]) => obj.error).map(([id, _]) => id);
        if (invalidObjects.length) {
          throw new Error(`The following input objects are invalid: ${invalidObjects.join(", ")}`);
        }
        objectsToResolve.forEach(({ id, input, normalizedType }) => {
          const object = objectsById.get(id);
          const owner = object.data?.owner;
          const initialSharedVersion = owner && typeof owner === "object" && "Shared" in owner ? owner.Shared.initial_shared_version : void 0;
          if (initialSharedVersion) {
            const isByValue = normalizedType != null && extractMutableReference(normalizedType) == null && extractReference(normalizedType) == null;
            const mutable = isMutableSharedObjectInput(input.value) || isByValue || normalizedType != null && extractMutableReference(normalizedType) != null;
            input.value = Inputs.SharedObjectRef({
              objectId: id,
              initialSharedVersion,
              mutable
            });
          } else if (normalizedType && isReceivingType(normalizedType)) {
            input.value = Inputs.ReceivingRef(object.data);
          } else {
            input.value = Inputs.ObjectRef(object.data);
          }
        });
      }
    };
    _prepare = new WeakSet();
    prepare_fn = async function(options) {
      if (!options.onlyTransactionKind && !__privateGet(this, _blockData).sender) {
        throw new Error("Missing transaction sender");
      }
      if (!options.protocolConfig && !options.limits && options.client) {
        options.protocolConfig = await options.client.getProtocolConfig();
      }
      await Promise.all([__privateMethod(this, _prepareGasPrice, prepareGasPrice_fn).call(this, options), __privateMethod(this, _prepareTransactions, prepareTransactions_fn).call(this, options)]);
      if (!options.onlyTransactionKind) {
        await __privateMethod(this, _prepareGasPayment, prepareGasPayment_fn).call(this, options);
        if (!__privateGet(this, _blockData).gasConfig.budget) {
          const dryRunResult = await expectClient(options).dryRunTransactionBlock({
            transactionBlock: __privateGet(this, _blockData).build({
              maxSizeBytes: __privateMethod(this, _getConfig, getConfig_fn).call(this, "maxTxSizeBytes", options),
              overrides: {
                gasConfig: {
                  budget: String(__privateMethod(this, _getConfig, getConfig_fn).call(this, "maxTxGas", options)),
                  payment: []
                }
              }
            })
          });
          if (dryRunResult.effects.status.status !== "success") {
            throw new Error(
              `Dry run failed, could not automatically determine a budget: ${dryRunResult.effects.status.error}`,
              { cause: dryRunResult }
            );
          }
          const safeOverhead = GAS_SAFE_OVERHEAD * BigInt(this.blockData.gasConfig.price || 1n);
          const baseComputationCostWithOverhead = BigInt(dryRunResult.effects.gasUsed.computationCost) + safeOverhead;
          const gasBudget = baseComputationCostWithOverhead + BigInt(dryRunResult.effects.gasUsed.storageCost) - BigInt(dryRunResult.effects.gasUsed.storageRebate);
          this.setGasBudget(
            gasBudget > baseComputationCostWithOverhead ? gasBudget : baseComputationCostWithOverhead
          );
        }
      }
      __privateMethod(this, _validate, validate_fn).call(this, options);
    };

    const SUI_CLIENT_BRAND = Symbol.for("@mysten/SuiClient");
    class SuiClient {
      get [SUI_CLIENT_BRAND]() {
        return true;
      }
      /**
       * Establish a connection to a Sui RPC endpoint
       *
       * @param options configuration options for the API Client
       */
      constructor(options) {
        this.transport = options.transport ?? new SuiHTTPTransport({ url: options.url });
      }
      async getRpcApiVersion() {
        const resp = await this.transport.request({
          method: "rpc.discover",
          params: []
        });
        return resp.info.version;
      }
      /**
       * Get all Coin<`coin_type`> objects owned by an address.
       */
      async getCoins(input) {
        if (!input.owner || !isValidSuiAddress(normalizeSuiAddress(input.owner))) {
          throw new Error("Invalid Sui address");
        }
        return await this.transport.request({
          method: "suix_getCoins",
          params: [input.owner, input.coinType, input.cursor, input.limit]
        });
      }
      /**
       * Get all Coin objects owned by an address.
       */
      async getAllCoins(input) {
        if (!input.owner || !isValidSuiAddress(normalizeSuiAddress(input.owner))) {
          throw new Error("Invalid Sui address");
        }
        return await this.transport.request({
          method: "suix_getAllCoins",
          params: [input.owner, input.cursor, input.limit]
        });
      }
      /**
       * Get the total coin balance for one coin type, owned by the address owner.
       */
      async getBalance(input) {
        if (!input.owner || !isValidSuiAddress(normalizeSuiAddress(input.owner))) {
          throw new Error("Invalid Sui address");
        }
        return await this.transport.request({
          method: "suix_getBalance",
          params: [input.owner, input.coinType]
        });
      }
      /**
       * Get the total coin balance for all coin types, owned by the address owner.
       */
      async getAllBalances(input) {
        if (!input.owner || !isValidSuiAddress(normalizeSuiAddress(input.owner))) {
          throw new Error("Invalid Sui address");
        }
        return await this.transport.request({ method: "suix_getAllBalances", params: [input.owner] });
      }
      /**
       * Fetch CoinMetadata for a given coin type
       */
      async getCoinMetadata(input) {
        return await this.transport.request({
          method: "suix_getCoinMetadata",
          params: [input.coinType]
        });
      }
      /**
       *  Fetch total supply for a coin
       */
      async getTotalSupply(input) {
        return await this.transport.request({
          method: "suix_getTotalSupply",
          params: [input.coinType]
        });
      }
      /**
       * Invoke any RPC method
       * @param method the method to be invoked
       * @param args the arguments to be passed to the RPC request
       */
      async call(method, params) {
        return await this.transport.request({ method, params });
      }
      /**
       * Get Move function argument types like read, write and full access
       */
      async getMoveFunctionArgTypes(input) {
        return await this.transport.request({
          method: "sui_getMoveFunctionArgTypes",
          params: [input.package, input.module, input.function]
        });
      }
      /**
       * Get a map from module name to
       * structured representations of Move modules
       */
      async getNormalizedMoveModulesByPackage(input) {
        return await this.transport.request({
          method: "sui_getNormalizedMoveModulesByPackage",
          params: [input.package]
        });
      }
      /**
       * Get a structured representation of Move module
       */
      async getNormalizedMoveModule(input) {
        return await this.transport.request({
          method: "sui_getNormalizedMoveModule",
          params: [input.package, input.module]
        });
      }
      /**
       * Get a structured representation of Move function
       */
      async getNormalizedMoveFunction(input) {
        return await this.transport.request({
          method: "sui_getNormalizedMoveFunction",
          params: [input.package, input.module, input.function]
        });
      }
      /**
       * Get a structured representation of Move struct
       */
      async getNormalizedMoveStruct(input) {
        return await this.transport.request({
          method: "sui_getNormalizedMoveStruct",
          params: [input.package, input.module, input.struct]
        });
      }
      /**
       * Get all objects owned by an address
       */
      async getOwnedObjects(input) {
        if (!input.owner || !isValidSuiAddress(normalizeSuiAddress(input.owner))) {
          throw new Error("Invalid Sui address");
        }
        return await this.transport.request({
          method: "suix_getOwnedObjects",
          params: [
            input.owner,
            {
              filter: input.filter,
              options: input.options
            },
            input.cursor,
            input.limit
          ]
        });
      }
      /**
       * Get details about an object
       */
      async getObject(input) {
        if (!input.id || !isValidSuiObjectId(normalizeSuiObjectId(input.id))) {
          throw new Error("Invalid Sui Object id");
        }
        return await this.transport.request({
          method: "sui_getObject",
          params: [input.id, input.options]
        });
      }
      async tryGetPastObject(input) {
        return await this.transport.request({
          method: "sui_tryGetPastObject",
          params: [input.id, input.version, input.options]
        });
      }
      /**
       * Batch get details about a list of objects. If any of the object ids are duplicates the call will fail
       */
      async multiGetObjects(input) {
        input.ids.forEach((id) => {
          if (!id || !isValidSuiObjectId(normalizeSuiObjectId(id))) {
            throw new Error(`Invalid Sui Object id ${id}`);
          }
        });
        const hasDuplicates = input.ids.length !== new Set(input.ids).size;
        if (hasDuplicates) {
          throw new Error(`Duplicate object ids in batch call ${input.ids}`);
        }
        return await this.transport.request({
          method: "sui_multiGetObjects",
          params: [input.ids, input.options]
        });
      }
      /**
       * Get transaction blocks for a given query criteria
       */
      async queryTransactionBlocks(input) {
        return await this.transport.request({
          method: "suix_queryTransactionBlocks",
          params: [
            {
              filter: input.filter,
              options: input.options
            },
            input.cursor,
            input.limit,
            (input.order || "descending") === "descending"
          ]
        });
      }
      async getTransactionBlock(input) {
        if (!isValidTransactionDigest(input.digest)) {
          throw new Error("Invalid Transaction digest");
        }
        return await this.transport.request({
          method: "sui_getTransactionBlock",
          params: [input.digest, input.options]
        });
      }
      async multiGetTransactionBlocks(input) {
        input.digests.forEach((d) => {
          if (!isValidTransactionDigest(d)) {
            throw new Error(`Invalid Transaction digest ${d}`);
          }
        });
        const hasDuplicates = input.digests.length !== new Set(input.digests).size;
        if (hasDuplicates) {
          throw new Error(`Duplicate digests in batch call ${input.digests}`);
        }
        return await this.transport.request({
          method: "sui_multiGetTransactionBlocks",
          params: [input.digests, input.options]
        });
      }
      async executeTransactionBlock(input) {
        return await this.transport.request({
          method: "sui_executeTransactionBlock",
          params: [
            typeof input.transactionBlock === "string" ? input.transactionBlock : toB64(input.transactionBlock),
            Array.isArray(input.signature) ? input.signature : [input.signature],
            input.options,
            input.requestType
          ]
        });
      }
      async signAndExecuteTransactionBlock({
        transactionBlock,
        signer,
        ...input
      }) {
        let transactionBytes;
        if (transactionBlock instanceof Uint8Array) {
          transactionBytes = transactionBlock;
        } else {
          transactionBlock.setSenderIfNotSet(signer.toSuiAddress());
          transactionBytes = await transactionBlock.build({ client: this });
        }
        const { signature, bytes } = await signer.signTransactionBlock(transactionBytes);
        return this.executeTransactionBlock({
          transactionBlock: bytes,
          signature,
          ...input
        });
      }
      /**
       * Get total number of transactions
       */
      async getTotalTransactionBlocks() {
        const resp = await this.transport.request({
          method: "sui_getTotalTransactionBlocks",
          params: []
        });
        return BigInt(resp);
      }
      /**
       * Getting the reference gas price for the network
       */
      async getReferenceGasPrice() {
        const resp = await this.transport.request({
          method: "suix_getReferenceGasPrice",
          params: []
        });
        return BigInt(resp);
      }
      /**
       * Return the delegated stakes for an address
       */
      async getStakes(input) {
        if (!input.owner || !isValidSuiAddress(normalizeSuiAddress(input.owner))) {
          throw new Error("Invalid Sui address");
        }
        return await this.transport.request({ method: "suix_getStakes", params: [input.owner] });
      }
      /**
       * Return the delegated stakes queried by id.
       */
      async getStakesByIds(input) {
        input.stakedSuiIds.forEach((id) => {
          if (!id || !isValidSuiObjectId(normalizeSuiObjectId(id))) {
            throw new Error(`Invalid Sui Stake id ${id}`);
          }
        });
        return await this.transport.request({
          method: "suix_getStakesByIds",
          params: [input.stakedSuiIds]
        });
      }
      /**
       * Return the latest system state content.
       */
      async getLatestSuiSystemState() {
        return await this.transport.request({ method: "suix_getLatestSuiSystemState", params: [] });
      }
      /**
       * Get events for a given query criteria
       */
      async queryEvents(input) {
        return await this.transport.request({
          method: "suix_queryEvents",
          params: [
            input.query,
            input.cursor,
            input.limit,
            (input.order || "descending") === "descending"
          ]
        });
      }
      /**
       * Subscribe to get notifications whenever an event matching the filter occurs
       */
      async subscribeEvent(input) {
        return this.transport.subscribe({
          method: "suix_subscribeEvent",
          unsubscribe: "suix_unsubscribeEvent",
          params: [input.filter],
          onMessage: input.onMessage
        });
      }
      async subscribeTransaction(input) {
        return this.transport.subscribe({
          method: "suix_subscribeTransaction",
          unsubscribe: "suix_unsubscribeTransaction",
          params: [input.filter],
          onMessage: input.onMessage
        });
      }
      /**
       * Runs the transaction block in dev-inspect mode. Which allows for nearly any
       * transaction (or Move call) with any arguments. Detailed results are
       * provided, including both the transaction effects and any return values.
       */
      async devInspectTransactionBlock(input) {
        let devInspectTxBytes;
        if (isTransactionBlock(input.transactionBlock)) {
          input.transactionBlock.setSenderIfNotSet(input.sender);
          devInspectTxBytes = toB64(
            await input.transactionBlock.build({
              client: this,
              onlyTransactionKind: true
            })
          );
        } else if (typeof input.transactionBlock === "string") {
          devInspectTxBytes = input.transactionBlock;
        } else if (input.transactionBlock instanceof Uint8Array) {
          devInspectTxBytes = toB64(input.transactionBlock);
        } else {
          throw new Error("Unknown transaction block format.");
        }
        return await this.transport.request({
          method: "sui_devInspectTransactionBlock",
          params: [input.sender, devInspectTxBytes, input.gasPrice?.toString(), input.epoch]
        });
      }
      /**
       * Dry run a transaction block and return the result.
       */
      async dryRunTransactionBlock(input) {
        return await this.transport.request({
          method: "sui_dryRunTransactionBlock",
          params: [
            typeof input.transactionBlock === "string" ? input.transactionBlock : toB64(input.transactionBlock)
          ]
        });
      }
      /**
       * Return the list of dynamic field objects owned by an object
       */
      async getDynamicFields(input) {
        if (!input.parentId || !isValidSuiObjectId(normalizeSuiObjectId(input.parentId))) {
          throw new Error("Invalid Sui Object id");
        }
        return await this.transport.request({
          method: "suix_getDynamicFields",
          params: [input.parentId, input.cursor, input.limit]
        });
      }
      /**
       * Return the dynamic field object information for a specified object
       */
      async getDynamicFieldObject(input) {
        return await this.transport.request({
          method: "suix_getDynamicFieldObject",
          params: [input.parentId, input.name]
        });
      }
      /**
       * Get the sequence number of the latest checkpoint that has been executed
       */
      async getLatestCheckpointSequenceNumber() {
        const resp = await this.transport.request({
          method: "sui_getLatestCheckpointSequenceNumber",
          params: []
        });
        return String(resp);
      }
      /**
       * Returns information about a given checkpoint
       */
      async getCheckpoint(input) {
        return await this.transport.request({ method: "sui_getCheckpoint", params: [input.id] });
      }
      /**
       * Returns historical checkpoints paginated
       */
      async getCheckpoints(input) {
        return await this.transport.request({
          method: "sui_getCheckpoints",
          params: [input.cursor, input?.limit, input.descendingOrder]
        });
      }
      /**
       * Return the committee information for the asked epoch
       */
      async getCommitteeInfo(input) {
        return await this.transport.request({
          method: "suix_getCommitteeInfo",
          params: [input?.epoch]
        });
      }
      async getNetworkMetrics() {
        return await this.transport.request({ method: "suix_getNetworkMetrics", params: [] });
      }
      async getAddressMetrics() {
        return await this.transport.request({ method: "suix_getLatestAddressMetrics", params: [] });
      }
      async getEpochMetrics(input) {
        return await this.transport.request({
          method: "suix_getEpochMetrics",
          params: [input?.cursor, input?.limit, input?.descendingOrder]
        });
      }
      async getAllEpochAddressMetrics(input) {
        return await this.transport.request({
          method: "suix_getAllEpochAddressMetrics",
          params: [input?.descendingOrder]
        });
      }
      /**
       * Return the committee information for the asked epoch
       */
      async getEpochs(input) {
        return await this.transport.request({
          method: "suix_getEpochs",
          params: [input?.cursor, input?.limit, input?.descendingOrder]
        });
      }
      /**
       * Returns list of top move calls by usage
       */
      async getMoveCallMetrics() {
        return await this.transport.request({ method: "suix_getMoveCallMetrics", params: [] });
      }
      /**
       * Return the committee information for the asked epoch
       */
      async getCurrentEpoch() {
        return await this.transport.request({ method: "suix_getCurrentEpoch", params: [] });
      }
      /**
       * Return the Validators APYs
       */
      async getValidatorsApy() {
        return await this.transport.request({ method: "suix_getValidatorsApy", params: [] });
      }
      // TODO: Migrate this to `sui_getChainIdentifier` once it is widely available.
      async getChainIdentifier() {
        const checkpoint = await this.getCheckpoint({ id: "0" });
        const bytes = fromB58(checkpoint.digest);
        return toHEX(bytes.slice(0, 4));
      }
      async resolveNameServiceAddress(input) {
        return await this.transport.request({
          method: "suix_resolveNameServiceAddress",
          params: [input.name]
        });
      }
      async resolveNameServiceNames({
        format = "dot",
        ...input
      }) {
        const { nextCursor, hasNextPage, data } = await this.transport.request({
          method: "suix_resolveNameServiceNames",
          params: [input.address, input.cursor, input.limit]
        });
        return {
          hasNextPage,
          nextCursor,
          data: data.map((name) => normalizeSuiNSName(name, format))
        };
      }
      async getProtocolConfig(input) {
        return await this.transport.request({
          method: "sui_getProtocolConfig",
          params: [input?.version]
        });
      }
      /**
       * Wait for a transaction block result to be available over the API.
       * This can be used in conjunction with `executeTransactionBlock` to wait for the transaction to
       * be available via the API.
       * This currently polls the `getTransactionBlock` API to check for the transaction.
       */
      async waitForTransactionBlock({
        signal,
        timeout = 60 * 1e3,
        pollInterval = 2 * 1e3,
        ...input
      }) {
        const timeoutSignal = AbortSignal.timeout(timeout);
        const timeoutPromise = new Promise((_, reject) => {
          timeoutSignal.addEventListener("abort", () => reject(timeoutSignal.reason));
        });
        timeoutPromise.catch(() => {
        });
        while (!timeoutSignal.aborted) {
          signal?.throwIfAborted();
          try {
            return await this.getTransactionBlock(input);
          } catch (e) {
            await Promise.race([
              new Promise((resolve) => setTimeout(resolve, pollInterval)),
              timeoutPromise
            ]);
          }
        }
        timeoutSignal.throwIfAborted();
        throw new Error("Unexpected error while waiting for transaction block.");
      }
    }

    const CONTRACT_CONFIG = {
      // ApexYield contract package address
      packageId: "0xe2f4a0385a2b5e31f67095fb4ba99e3048eb05012ba3698ef6c80fbb675fe138",
      
      // Global pause status object (shared object)
      globalPauseStatusId: "0x27a51b2510dd1dcf2949197eda3a4ec4bb71100cc2fc873fcbf772e47d8e975b",
      
      // Admin capability object (admin only)
      adminCapId: "0x2fc12acd6dd4ac5a5e427db099a23455981b168da8309b260655947247d0ca7e",
      
      // Upgrade capability object (admin only)
      upgradeCapId: "0x64db96d87ef347cda46d3a0a53a9ad1fbdfc074ffa158e4f53b26389604ae238",
      
      // Network configuration
      network: "testnet",
      rpc: "https://fullnode.testnet.sui.io:443"
    };

    const COMMON_COIN_TYPES = {
      SUI: "0x2::sui::SUI",
      USDC: "0x123::usdc::USDC", // Example address
      USDT: "0x456::usdt::USDT"  // Example address
    };

    const DEFAULT_SLIPPAGE_TOLERANCE = 1; // 1%

    // Initialize Sui client
    const suiClient = new SuiClient({ 
      url: CONTRACT_CONFIG.rpc 
    });

    async function executeTransactionWithRetry(txb, signer, maxRetries = 3) {
      for (let i = 0; i < maxRetries; i++) {
        try {
          const result = await suiClient.signAndExecuteTransactionBlock({
            transactionBlock: txb,
            signer: signer,
            options: {
              showEffects: true,
              showObjectChanges: true
            }
          });
          
          // Check if transaction was successful
          if (result.effects?.status?.status === 'success') {
            return result;
          } else {
            throw new Error('Transaction execution failed');
          }
          
        } catch (error) {
          console.error(`Transaction attempt ${i + 1} failed:`, error);
          
          if (i === maxRetries - 1) {
            throw error; // Last retry failed, throw error
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }

    function handleTransactionError(error) {
      const errorMessage = error.message || error.toString();
      
      // Common error types
      if (errorMessage.includes('InsufficientBalance')) {
        return 'Insufficient balance';
      } else if (errorMessage.includes('SlippageTooHigh')) {
        return 'Slippage too high, please adjust parameters';
      } else if (errorMessage.includes('PoolPaused')) {
        return 'Pool is paused';
      } else if (errorMessage.includes('MinAmountNotMet')) {
        return 'Output amount below minimum';
      } else if (errorMessage.includes('DeadlineExceeded')) {
        return 'Transaction timeout';
      } else {
        return `Transaction failed: ${errorMessage}`;
      }
    }

    async function waitForTransactionConfirmation(transactionDigest, maxWaitTime = 30000) {
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime) {
        try {
          const txResult = await suiClient.getTransactionBlock({
            digest: transactionDigest,
            options: {
              showEffects: true
            }
          });
          
          if (txResult.effects?.status?.status === 'success') {
            console.log('Transaction confirmed:', transactionDigest);
            return { confirmed: true, result: txResult };
          } else if (txResult.effects?.status?.status === 'failure') {
            console.error('Transaction failed:', txResult.effects?.status?.error);
            return { confirmed: false, error: txResult.effects?.status?.error };
          }
          
        } catch (error) {
          console.log('Transaction not yet confirmed, waiting...');
        }
        
        // Wait 2 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      throw new Error('Transaction confirmation timeout');
    }

    /**
     * Get pool information
     */
    async function getPoolInfo(poolId) {
      try {
        const poolObject = await suiClient.getObject({
          id: poolId,
          options: {
            showContent: true,
            showType: true
          }
        });
        
        if (poolObject.data?.content?.dataType === 'moveObject') {
          const fields = poolObject.data.content.fields;
          
          return {
            coinTypeA: fields.coin_type_a,
            coinTypeB: fields.coin_type_b,
            reserveA: fields.reserve_a,
            reserveB: fields.reserve_b,
            totalSupply: fields.lp_supply,
            feeRate: fields.fee_rate,
            protocolFeeRate: fields.protocol_fee_rate
          };
        }
        
        throw new Error('Unable to get pool information');
        
      } catch (error) {
        console.error('Get pool info failed:', error);
        throw error;
      }
    }

    /**
     * Calculate swap output amount (without executing transaction)
     */
    function calculateAmountOut(amountIn, reserveIn, reserveOut, feeRate = 30) {
      const amountInWithFee = amountIn * (10000 - feeRate);
      const numerator = amountInWithFee * reserveOut;
      const denominator = reserveIn * 10000 + amountInWithFee;
      return Math.floor(numerator / denominator);
    }

    /**
     * Calculate price impact
     */
    function calculatePriceImpact(amountIn, amountOut, reserveIn, reserveOut) {
      const preBuyPrice = reserveOut / reserveIn;
      const postBuyPrice = (reserveOut - amountOut) / (reserveIn + amountIn);
      return Math.abs((postBuyPrice - preBuyPrice) / preBuyPrice) * 100;
    }

    /**
     * Get swap quote
     */
    async function getSwapQuote(poolId, amountIn, swapAForB = true) {
      try {
        const poolInfo = await getPoolInfo(poolId);
        
        const [reserveIn, reserveOut] = swapAForB 
          ? [poolInfo.reserveA, poolInfo.reserveB]
          : [poolInfo.reserveB, poolInfo.reserveA];
        
        const amountOut = calculateAmountOut(
          amountIn, 
          parseInt(reserveIn), 
          parseInt(reserveOut), 
          poolInfo.feeRate
        );
        
        const priceImpact = calculatePriceImpact(amountIn, amountOut, reserveIn, reserveOut);
        
        return {
          amountOut,
          priceImpact,
          feeAmount: Math.floor(amountIn * poolInfo.feeRate / 10000),
          exchangeRate: amountOut / amountIn
        };
        
      } catch (error) {
        console.error('Get swap quote failed:', error);
        throw error;
      }
    }

    /**
     * Get user token balance
     */
    async function getUserBalance(userAddress, coinType) {
      try {
        const coins = await suiClient.getCoins({
          owner: userAddress,
          coinType: coinType
        });
        
        const totalBalance = coins.data.reduce((sum, coin) => 
          sum + parseInt(coin.balance), 0
        );
        
        return {
          totalBalance,
          coinCount: coins.data.length,
          coins: coins.data
        };
        
      } catch (error) {
        console.error('Get balance failed:', error);
        throw error;
      }
    }

    /**
     * Calculate minimum amount with slippage protection
     */
    function calculateMinAmountWithSlippage(expectedAmount, slippageTolerance = 1) {
      return Math.floor(expectedAmount * (100 - slippageTolerance) / 100);
    }

    /* src/components/WalletConnection.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1, console: console_1$2 } = globals;
    const file$4 = "src/components/WalletConnection.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i][0];
    	child_ctx[10] = list[i][1];
    	return child_ctx;
    }

    // (126:2) {:else}
    function create_else_block$2(ctx) {
    	let div1;
    	let h3;
    	let t1;
    	let p0;
    	let t3;
    	let t4;
    	let button;

    	let t5_value = (/*connecting*/ ctx[1]
    	? 'Connecting...'
    	: 'Connect Demo Wallet') + "";

    	let t5;
    	let t6;
    	let div0;
    	let p1;
    	let t8;
    	let ul;
    	let li0;
    	let t10;
    	let li1;
    	let t12;
    	let li2;
    	let t14;
    	let li3;
    	let mounted;
    	let dispose;
    	let if_block = /*error*/ ctx[2] && create_if_block_1$4(ctx);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			h3 = element("h3");
    			h3.textContent = "Connect Wallet";
    			t1 = space();
    			p0 = element("p");
    			p0.textContent = "Connect your wallet to start trading on Cetus AMM";
    			t3 = space();
    			if (if_block) if_block.c();
    			t4 = space();
    			button = element("button");
    			t5 = text(t5_value);
    			t6 = space();
    			div0 = element("div");
    			p1 = element("p");
    			p1.textContent = "In a production app, you would see options for:";
    			t8 = space();
    			ul = element("ul");
    			li0 = element("li");
    			li0.textContent = "Sui Wallet";
    			t10 = space();
    			li1 = element("li");
    			li1.textContent = "Suiet Wallet";
    			t12 = space();
    			li2 = element("li");
    			li2.textContent = "Ethos Wallet";
    			t14 = space();
    			li3 = element("li");
    			li3.textContent = "Other Sui-compatible wallets";
    			attr_dev(h3, "class", "svelte-kx1lo8");
    			add_location(h3, file$4, 127, 6, 3670);
    			attr_dev(p0, "class", "svelte-kx1lo8");
    			add_location(p0, file$4, 128, 6, 3700);
    			button.disabled = /*connecting*/ ctx[1];
    			attr_dev(button, "class", "primary-button connect-btn svelte-kx1lo8");
    			add_location(button, file$4, 134, 6, 3842);
    			attr_dev(p1, "class", "note svelte-kx1lo8");
    			add_location(p1, file$4, 143, 8, 4088);
    			attr_dev(li0, "class", "svelte-kx1lo8");
    			add_location(li0, file$4, 147, 10, 4219);
    			attr_dev(li1, "class", "svelte-kx1lo8");
    			add_location(li1, file$4, 148, 10, 4249);
    			attr_dev(li2, "class", "svelte-kx1lo8");
    			add_location(li2, file$4, 149, 10, 4281);
    			attr_dev(li3, "class", "svelte-kx1lo8");
    			add_location(li3, file$4, 150, 10, 4313);
    			attr_dev(ul, "class", "wallet-list svelte-kx1lo8");
    			add_location(ul, file$4, 146, 8, 4184);
    			attr_dev(div0, "class", "wallet-options svelte-kx1lo8");
    			add_location(div0, file$4, 142, 6, 4051);
    			attr_dev(div1, "class", "connect-section svelte-kx1lo8");
    			add_location(div1, file$4, 126, 4, 3634);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, h3);
    			append_dev(div1, t1);
    			append_dev(div1, p0);
    			append_dev(div1, t3);
    			if (if_block) if_block.m(div1, null);
    			append_dev(div1, t4);
    			append_dev(div1, button);
    			append_dev(button, t5);
    			append_dev(div1, t6);
    			append_dev(div1, div0);
    			append_dev(div0, p1);
    			append_dev(div0, t8);
    			append_dev(div0, ul);
    			append_dev(ul, li0);
    			append_dev(ul, t10);
    			append_dev(ul, li1);
    			append_dev(ul, t12);
    			append_dev(ul, li2);
    			append_dev(ul, t14);
    			append_dev(ul, li3);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*connectWallet*/ ctx[4], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (/*error*/ ctx[2]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1$4(ctx);
    					if_block.c();
    					if_block.m(div1, t4);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*connecting*/ 2 && t5_value !== (t5_value = (/*connecting*/ ctx[1]
    			? 'Connecting...'
    			: 'Connect Demo Wallet') + "")) set_data_dev(t5, t5_value);

    			if (dirty & /*connecting*/ 2) {
    				prop_dev(button, "disabled", /*connecting*/ ctx[1]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (if_block) if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$2.name,
    		type: "else",
    		source: "(126:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (85:2) {#if wallet && wallet.connected}
    function create_if_block$4(ctx) {
    	let div7;
    	let div2;
    	let div1;
    	let div0;
    	let t0;
    	let span;
    	let t1_value = /*wallet*/ ctx[0].provider + "";
    	let t1;
    	let t2;
    	let button0;
    	let t4;
    	let div6;
    	let div3;
    	let label;
    	let t6;
    	let code;
    	let t7_value = formatAddress(/*wallet*/ ctx[0].address) + "";
    	let t7;
    	let t8;
    	let button1;
    	let t10;
    	let div5;
    	let h4;
    	let t12;
    	let div4;
    	let t13;
    	let button2;
    	let mounted;
    	let dispose;
    	let each_value = Object.entries(/*userBalances*/ ctx[3]);
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div7 = element("div");
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			t0 = space();
    			span = element("span");
    			t1 = text(t1_value);
    			t2 = space();
    			button0 = element("button");
    			button0.textContent = "Disconnect";
    			t4 = space();
    			div6 = element("div");
    			div3 = element("div");
    			label = element("label");
    			label.textContent = "Address:";
    			t6 = space();
    			code = element("code");
    			t7 = text(t7_value);
    			t8 = space();
    			button1 = element("button");
    			button1.textContent = "📋";
    			t10 = space();
    			div5 = element("div");
    			h4 = element("h4");
    			h4.textContent = "Balances";
    			t12 = space();
    			div4 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t13 = space();
    			button2 = element("button");
    			button2.textContent = "Refresh Balances";
    			attr_dev(div0, "class", "status-indicator connected svelte-kx1lo8");
    			add_location(div0, file$4, 88, 10, 2406);
    			attr_dev(span, "class", "provider-name svelte-kx1lo8");
    			add_location(span, file$4, 89, 10, 2463);
    			attr_dev(div1, "class", "wallet-status svelte-kx1lo8");
    			add_location(div1, file$4, 87, 8, 2368);
    			attr_dev(button0, "class", "disconnect-btn svelte-kx1lo8");
    			add_location(button0, file$4, 91, 8, 2539);
    			attr_dev(div2, "class", "wallet-header svelte-kx1lo8");
    			add_location(div2, file$4, 86, 6, 2332);
    			attr_dev(label, "class", "svelte-kx1lo8");
    			add_location(label, file$4, 98, 10, 2741);
    			attr_dev(code, "class", "address svelte-kx1lo8");
    			add_location(code, file$4, 99, 10, 2775);
    			attr_dev(button1, "class", "copy-btn svelte-kx1lo8");
    			attr_dev(button1, "title", "Copy address");
    			add_location(button1, file$4, 100, 10, 2846);
    			attr_dev(div3, "class", "address-section svelte-kx1lo8");
    			add_location(div3, file$4, 97, 8, 2701);
    			attr_dev(h4, "class", "svelte-kx1lo8");
    			add_location(h4, file$4, 110, 10, 3105);
    			attr_dev(div4, "class", "balances-grid svelte-kx1lo8");
    			add_location(div4, file$4, 111, 10, 3133);
    			attr_dev(button2, "class", "refresh-btn svelte-kx1lo8");
    			add_location(button2, file$4, 119, 10, 3475);
    			attr_dev(div5, "class", "balances-section svelte-kx1lo8");
    			add_location(div5, file$4, 109, 8, 3064);
    			attr_dev(div6, "class", "wallet-details");
    			add_location(div6, file$4, 96, 6, 2664);
    			attr_dev(div7, "class", "wallet-info");
    			add_location(div7, file$4, 85, 4, 2300);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div7, anchor);
    			append_dev(div7, div2);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div1, t0);
    			append_dev(div1, span);
    			append_dev(span, t1);
    			append_dev(div2, t2);
    			append_dev(div2, button0);
    			append_dev(div7, t4);
    			append_dev(div7, div6);
    			append_dev(div6, div3);
    			append_dev(div3, label);
    			append_dev(div3, t6);
    			append_dev(div3, code);
    			append_dev(code, t7);
    			append_dev(div3, t8);
    			append_dev(div3, button1);
    			append_dev(div6, t10);
    			append_dev(div6, div5);
    			append_dev(div5, h4);
    			append_dev(div5, t12);
    			append_dev(div5, div4);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div4, null);
    				}
    			}

    			append_dev(div5, t13);
    			append_dev(div5, button2);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*disconnectWallet*/ ctx[5], false, false, false, false),
    					listen_dev(button1, "click", /*click_handler*/ ctx[7], false, false, false, false),
    					listen_dev(button2, "click", /*loadUserBalances*/ ctx[6], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*wallet*/ 1 && t1_value !== (t1_value = /*wallet*/ ctx[0].provider + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*wallet*/ 1 && t7_value !== (t7_value = formatAddress(/*wallet*/ ctx[0].address) + "")) set_data_dev(t7, t7_value);

    			if (dirty & /*formatBalance, Object, userBalances*/ 8) {
    				each_value = Object.entries(/*userBalances*/ ctx[3]);
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$3(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$3(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div4, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div7);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(85:2) {#if wallet && wallet.connected}",
    		ctx
    	});

    	return block;
    }

    // (131:6) {#if error}
    function create_if_block_1$4(ctx) {
    	let div;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(/*error*/ ctx[2]);
    			attr_dev(div, "class", "error");
    			add_location(div, file$4, 131, 8, 3790);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*error*/ 4) set_data_dev(t, /*error*/ ctx[2]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$4.name,
    		type: "if",
    		source: "(131:6) {#if error}",
    		ctx
    	});

    	return block;
    }

    // (113:12) {#each Object.entries(userBalances) as [symbol, balance]}
    function create_each_block$3(ctx) {
    	let div;
    	let span0;
    	let t0_value = /*symbol*/ ctx[9] + "";
    	let t0;
    	let t1;
    	let span1;
    	let t2_value = formatBalance(/*balance*/ ctx[10]) + "";
    	let t2;
    	let t3;

    	const block = {
    		c: function create() {
    			div = element("div");
    			span0 = element("span");
    			t0 = text(t0_value);
    			t1 = space();
    			span1 = element("span");
    			t2 = text(t2_value);
    			t3 = space();
    			attr_dev(span0, "class", "token-symbol svelte-kx1lo8");
    			add_location(span0, file$4, 114, 16, 3288);
    			attr_dev(span1, "class", "token-balance svelte-kx1lo8");
    			add_location(span1, file$4, 115, 16, 3347);
    			attr_dev(div, "class", "balance-item svelte-kx1lo8");
    			add_location(div, file$4, 113, 14, 3245);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, span0);
    			append_dev(span0, t0);
    			append_dev(div, t1);
    			append_dev(div, span1);
    			append_dev(span1, t2);
    			append_dev(div, t3);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*userBalances*/ 8 && t0_value !== (t0_value = /*symbol*/ ctx[9] + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*userBalances*/ 8 && t2_value !== (t2_value = formatBalance(/*balance*/ ctx[10]) + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$3.name,
    		type: "each",
    		source: "(113:12) {#each Object.entries(userBalances) as [symbol, balance]}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let div;

    	function select_block_type(ctx, dirty) {
    		if (/*wallet*/ ctx[0] && /*wallet*/ ctx[0].connected) return create_if_block$4;
    		return create_else_block$2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			attr_dev(div, "class", "wallet-connection svelte-kx1lo8");
    			add_location(div, file$4, 83, 0, 2229);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_block.m(div, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function formatAddress(address) {
    	if (!address) return '';
    	return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    function formatBalance(balance) {
    	return (balance / 1e9).toFixed(6);
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('WalletConnection', slots, []);
    	const dispatch = createEventDispatcher();
    	let { wallet = null } = $$props;
    	let connecting = false;
    	let error = '';
    	let userBalances = {};

    	// Simulate wallet connection (in a real app, you'd use @mysten/wallet-kit)
    	async function connectWallet() {
    		$$invalidate(1, connecting = true);
    		$$invalidate(2, error = '');

    		try {
    			// In a real application, this would integrate with actual wallet providers
    			// For demo purposes, we'll create a keypair
    			const keypair = Ed25519Keypair.generate();

    			const address = keypair.getPublicKey().toSuiAddress();

    			const newWallet = {
    				address,
    				signer: keypair,
    				connected: true,
    				provider: 'Demo Wallet'
    			};

    			$$invalidate(0, wallet = newWallet);
    			dispatch('walletConnected', wallet);

    			// Load user balances
    			await loadUserBalances();
    		} catch(err) {
    			$$invalidate(2, error = `Failed to connect wallet: ${err.message}`);
    			console.error('Wallet connection error:', err);
    		} finally {
    			$$invalidate(1, connecting = false);
    		}
    	}

    	async function disconnectWallet() {
    		$$invalidate(0, wallet = null);
    		$$invalidate(3, userBalances = {});
    		dispatch('walletDisconnected');
    	}

    	async function loadUserBalances() {
    		if (!wallet) return;

    		try {
    			const balancePromises = Object.entries(COMMON_COIN_TYPES).map(async ([symbol, coinType]) => {
    				try {
    					const balance = await getUserBalance(wallet.address, coinType);
    					return [symbol, balance.totalBalance];
    				} catch(err) {
    					console.error(`Failed to load ${symbol} balance:`, err);
    					return [symbol, 0];
    				}
    			});

    			const balances = await Promise.all(balancePromises);
    			$$invalidate(3, userBalances = Object.fromEntries(balances));
    		} catch(err) {
    			console.error('Failed to load balances:', err);
    		}
    	}

    	const writable_props = ['wallet'];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$2.warn(`<WalletConnection> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => navigator.clipboard?.writeText(wallet.address);

    	$$self.$$set = $$props => {
    		if ('wallet' in $$props) $$invalidate(0, wallet = $$props.wallet);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		Ed25519Keypair,
    		getUserBalance,
    		COMMON_COIN_TYPES,
    		dispatch,
    		wallet,
    		connecting,
    		error,
    		userBalances,
    		connectWallet,
    		disconnectWallet,
    		loadUserBalances,
    		formatAddress,
    		formatBalance
    	});

    	$$self.$inject_state = $$props => {
    		if ('wallet' in $$props) $$invalidate(0, wallet = $$props.wallet);
    		if ('connecting' in $$props) $$invalidate(1, connecting = $$props.connecting);
    		if ('error' in $$props) $$invalidate(2, error = $$props.error);
    		if ('userBalances' in $$props) $$invalidate(3, userBalances = $$props.userBalances);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		wallet,
    		connecting,
    		error,
    		userBalances,
    		connectWallet,
    		disconnectWallet,
    		loadUserBalances,
    		click_handler
    	];
    }

    class WalletConnection extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { wallet: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "WalletConnection",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get wallet() {
    		throw new Error("<WalletConnection>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set wallet(value) {
    		throw new Error("<WalletConnection>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /**
     * Add liquidity to pool
     */
    async function addLiquidity(poolId, coinTypeA, coinTypeB, coinAId, coinBId, amountA, amountB, minAmountA, minAmountB, signer) {
      try {
        const txb = new TransactionBlock();
        
        txb.moveCall({
          target: `${CONTRACT_CONFIG.packageId}::amm_script::add_liquidity`,
          typeArguments: [coinTypeA, coinTypeB],
          arguments: [
            txb.object(poolId),                           // Pool object
            txb.object(CONTRACT_CONFIG.globalPauseStatusId), // Global pause status
            txb.object(coinAId),                          // Coin A
            txb.object(coinBId),                          // Coin B
            txb.pure(amountA),                            // Amount A
            txb.pure(amountB),                            // Amount B
            txb.pure(minAmountA),                         // Min amount A
            txb.pure(minAmountB)                          // Min amount B
          ]
        });
        
        const result = await executeTransactionWithRetry(txb, signer);
        
        // Extract LP token object ID
        const lpTokenObject = result.objectChanges?.find(
          obj => obj.type === 'created' && obj.objectType.includes('LpToken')
        );
        
        return {
          success: true,
          lpTokenId: lpTokenObject?.objectId,
          transactionDigest: result.digest
        };
        
      } catch (error) {
        console.error('Add liquidity failed:', error);
        return {
          success: false,
          error: error.message
        };
      }
    }

    /**
     * Remove liquidity from pool
     */
    async function removeLiquidity(poolId, coinTypeA, coinTypeB, lpTokenId, liquidity, minAmountA, minAmountB, signer) {
      try {
        const txb = new TransactionBlock();
        
        txb.moveCall({
          target: `${CONTRACT_CONFIG.packageId}::amm_script::remove_liquidity`,
          typeArguments: [coinTypeA, coinTypeB],
          arguments: [
            txb.object(poolId),                           // Pool object
            txb.object(CONTRACT_CONFIG.globalPauseStatusId), // Global pause status
            txb.object(lpTokenId),                        // LP token
            txb.pure(liquidity),                          // Liquidity amount
            txb.pure(minAmountA),                         // Min amount A
            txb.pure(minAmountB)                          // Min amount B
          ]
        });
        
        const result = await executeTransactionWithRetry(txb, signer);
        
        return {
          success: true,
          transactionDigest: result.digest
        };
        
      } catch (error) {
        console.error('Remove liquidity failed:', error);
        return {
          success: false,
          error: error.message
        };
      }
    }

    /**
     * Swap exact coin A for coin B
     */
    async function swapExactAForB(poolId, coinTypeA, coinTypeB, coinAId, amountIn, minAmountOut, signer) {
      try {
        const txb = new TransactionBlock();
        
        txb.moveCall({
          target: `${CONTRACT_CONFIG.packageId}::amm_script::swap_exact_coinA_for_coinB`,
          typeArguments: [coinTypeA, coinTypeB],
          arguments: [
            txb.object(poolId),                           // Pool object
            txb.object(CONTRACT_CONFIG.globalPauseStatusId), // Global pause status
            txb.object(coinAId),                          // Input coin A
            txb.pure(amountIn),                           // Input amount
            txb.pure(minAmountOut)                        // Min output amount
          ]
        });
        
        const result = await executeTransactionWithRetry(txb, signer);
        
        // Extract output coin B object ID
        const coinBObject = result.objectChanges?.find(
          obj => obj.type === 'created' && obj.objectType.includes(coinTypeB)
        );
        
        return {
          success: true,
          outputCoinId: coinBObject?.objectId,
          transactionDigest: result.digest
        };
        
      } catch (error) {
        console.error('Token swap failed:', error);
        return {
          success: false,
          error: error.message
        };
      }
    }

    /* src/components/SwapComponent.svelte generated by Svelte v3.59.2 */
    const file$3 = "src/components/SwapComponent.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[18] = list[i];
    	return child_ctx;
    }

    // (123:8) {#each availablePools as pool}
    function create_each_block$2(ctx) {
    	let option;
    	let t_value = /*pool*/ ctx[18].name + "";
    	let t;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = /*pool*/ ctx[18].id;
    			option.value = option.__value;
    			add_location(option, file$3, 123, 10, 3378);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(123:8) {#each availablePools as pool}",
    		ctx
    	});

    	return block;
    }

    // (155:4) {#if quote}
    function create_if_block_2$2(ctx) {
    	let div;
    	let p0;
    	let strong0;
    	let t1;
    	let t2_value = /*quote*/ ctx[3].exchangeRate.toFixed(6) + "";
    	let t2;
    	let t3;
    	let p1;
    	let strong1;
    	let t5;
    	let t6_value = (/*quote*/ ctx[3].feeAmount / 1e9).toFixed(6) + "";
    	let t6;
    	let t7;
    	let p2;
    	let strong2;
    	let t9;
    	let t10_value = /*quote*/ ctx[3].priceImpact.toFixed(2) + "";
    	let t10;
    	let t11;
    	let t12;
    	let if_block = /*quote*/ ctx[3].priceImpact > 3 && create_if_block_3$2(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			p0 = element("p");
    			strong0 = element("strong");
    			strong0.textContent = "Exchange Rate:";
    			t1 = text(" 1 = ");
    			t2 = text(t2_value);
    			t3 = space();
    			p1 = element("p");
    			strong1 = element("strong");
    			strong1.textContent = "Fee:";
    			t5 = space();
    			t6 = text(t6_value);
    			t7 = space();
    			p2 = element("p");
    			strong2 = element("strong");
    			strong2.textContent = "Price Impact:";
    			t9 = space();
    			t10 = text(t10_value);
    			t11 = text("%");
    			t12 = space();
    			if (if_block) if_block.c();
    			add_location(strong0, file$3, 156, 11, 4088);
    			add_location(p0, file$3, 156, 8, 4085);
    			add_location(strong1, file$3, 157, 11, 4171);
    			add_location(p1, file$3, 157, 8, 4168);
    			add_location(strong2, file$3, 158, 11, 4245);
    			add_location(p2, file$3, 158, 8, 4242);
    			attr_dev(div, "class", "quote-info");
    			add_location(div, file$3, 155, 6, 4052);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, p0);
    			append_dev(p0, strong0);
    			append_dev(p0, t1);
    			append_dev(p0, t2);
    			append_dev(div, t3);
    			append_dev(div, p1);
    			append_dev(p1, strong1);
    			append_dev(p1, t5);
    			append_dev(p1, t6);
    			append_dev(div, t7);
    			append_dev(div, p2);
    			append_dev(p2, strong2);
    			append_dev(p2, t9);
    			append_dev(p2, t10);
    			append_dev(p2, t11);
    			append_dev(div, t12);
    			if (if_block) if_block.m(div, null);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*quote*/ 8 && t2_value !== (t2_value = /*quote*/ ctx[3].exchangeRate.toFixed(6) + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*quote*/ 8 && t6_value !== (t6_value = (/*quote*/ ctx[3].feeAmount / 1e9).toFixed(6) + "")) set_data_dev(t6, t6_value);
    			if (dirty & /*quote*/ 8 && t10_value !== (t10_value = /*quote*/ ctx[3].priceImpact.toFixed(2) + "")) set_data_dev(t10, t10_value);

    			if (/*quote*/ ctx[3].priceImpact > 3) {
    				if (if_block) ; else {
    					if_block = create_if_block_3$2(ctx);
    					if_block.c();
    					if_block.m(div, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block) if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$2.name,
    		type: "if",
    		source: "(155:4) {#if quote}",
    		ctx
    	});

    	return block;
    }

    // (160:8) {#if quote.priceImpact > 3}
    function create_if_block_3$2(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "⚠️ High price impact";
    			attr_dev(p, "class", "warning svelte-19f80vl");
    			add_location(p, file$3, 160, 10, 4358);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3$2.name,
    		type: "if",
    		source: "(160:8) {#if quote.priceImpact > 3}",
    		ctx
    	});

    	return block;
    }

    // (166:4) {#if error}
    function create_if_block_1$3(ctx) {
    	let div;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(/*error*/ ctx[6]);
    			attr_dev(div, "class", "error");
    			add_location(div, file$3, 166, 6, 4462);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*error*/ 64) set_data_dev(t, /*error*/ ctx[6]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$3.name,
    		type: "if",
    		source: "(166:4) {#if error}",
    		ctx
    	});

    	return block;
    }

    // (170:4) {#if success}
    function create_if_block$3(ctx) {
    	let div;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(/*success*/ ctx[7]);
    			attr_dev(div, "class", "success");
    			add_location(div, file$3, 170, 6, 4530);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*success*/ 128) set_data_dev(t, /*success*/ ctx[7]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(170:4) {#if success}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let div5;
    	let h2;
    	let t1;
    	let div4;
    	let div0;
    	let label0;
    	let t3;
    	let input0;
    	let t4;
    	let select;
    	let option;
    	let t6;
    	let div1;
    	let button0;
    	let t8;
    	let div2;
    	let label1;
    	let t10;
    	let input1;
    	let t11;
    	let div3;
    	let label2;
    	let t13;
    	let input2;
    	let t14;
    	let t15;
    	let t16;
    	let t17;
    	let button1;
    	let t18_value = (/*loading*/ ctx[4] ? 'Swapping...' : 'Swap') + "";
    	let t18;
    	let button1_disabled_value;
    	let mounted;
    	let dispose;
    	let each_value = /*availablePools*/ ctx[9];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	let if_block0 = /*quote*/ ctx[3] && create_if_block_2$2(ctx);
    	let if_block1 = /*error*/ ctx[6] && create_if_block_1$3(ctx);
    	let if_block2 = /*success*/ ctx[7] && create_if_block$3(ctx);

    	const block = {
    		c: function create() {
    			div5 = element("div");
    			h2 = element("h2");
    			h2.textContent = "Token Swap";
    			t1 = space();
    			div4 = element("div");
    			div0 = element("div");
    			label0 = element("label");
    			label0.textContent = "From";
    			t3 = space();
    			input0 = element("input");
    			t4 = space();
    			select = element("select");
    			option = element("option");
    			option.textContent = "Select trading pair";

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t6 = space();
    			div1 = element("div");
    			button0 = element("button");
    			button0.textContent = "⇅";
    			t8 = space();
    			div2 = element("div");
    			label1 = element("label");
    			label1.textContent = "To";
    			t10 = space();
    			input1 = element("input");
    			t11 = space();
    			div3 = element("div");
    			label2 = element("label");
    			label2.textContent = "Slippage Tolerance (%)";
    			t13 = space();
    			input2 = element("input");
    			t14 = space();
    			if (if_block0) if_block0.c();
    			t15 = space();
    			if (if_block1) if_block1.c();
    			t16 = space();
    			if (if_block2) if_block2.c();
    			t17 = space();
    			button1 = element("button");
    			t18 = text(t18_value);
    			add_location(h2, file$3, 108, 2, 2978);
    			add_location(label0, file$3, 112, 6, 3063);
    			attr_dev(input0, "type", "number");
    			attr_dev(input0, "placeholder", "Enter amount");
    			attr_dev(input0, "step", "0.000001");
    			attr_dev(input0, "min", "0");
    			add_location(input0, file$3, 113, 6, 3089);
    			option.__value = "";
    			option.value = option.__value;
    			add_location(option, file$3, 121, 8, 3283);
    			attr_dev(select, "class", "svelte-19f80vl");
    			if (/*selectedPool*/ ctx[0] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[13].call(select));
    			add_location(select, file$3, 120, 6, 3240);
    			attr_dev(div0, "class", "input-group");
    			add_location(div0, file$3, 111, 4, 3031);
    			attr_dev(button0, "type", "button");
    			attr_dev(button0, "class", "switch-btn svelte-19f80vl");
    			add_location(button0, file$3, 129, 6, 3502);
    			attr_dev(div1, "class", "swap-arrow svelte-19f80vl");
    			add_location(div1, file$3, 128, 4, 3471);
    			add_location(label1, file$3, 133, 6, 3626);
    			attr_dev(input1, "type", "number");
    			attr_dev(input1, "placeholder", "Output amount");
    			input1.readOnly = true;
    			add_location(input1, file$3, 134, 6, 3650);
    			attr_dev(div2, "class", "input-group");
    			add_location(div2, file$3, 132, 4, 3594);
    			add_location(label2, file$3, 143, 6, 3819);
    			attr_dev(input2, "type", "number");
    			attr_dev(input2, "placeholder", "1");
    			attr_dev(input2, "step", "0.1");
    			attr_dev(input2, "min", "0.1");
    			attr_dev(input2, "max", "10");
    			add_location(input2, file$3, 144, 6, 3863);
    			attr_dev(div3, "class", "input-group");
    			add_location(div3, file$3, 142, 4, 3787);
    			button1.disabled = button1_disabled_value = /*loading*/ ctx[4] || !/*quote*/ ctx[3] || !/*wallet*/ ctx[1];
    			attr_dev(button1, "class", "primary-button");
    			add_location(button1, file$3, 173, 4, 4582);
    			attr_dev(div4, "class", "swap-form svelte-19f80vl");
    			add_location(div4, file$3, 110, 2, 3003);
    			attr_dev(div5, "class", "card");
    			add_location(div5, file$3, 107, 0, 2957);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div5, anchor);
    			append_dev(div5, h2);
    			append_dev(div5, t1);
    			append_dev(div5, div4);
    			append_dev(div4, div0);
    			append_dev(div0, label0);
    			append_dev(div0, t3);
    			append_dev(div0, input0);
    			set_input_value(input0, /*fromAmount*/ ctx[2]);
    			append_dev(div0, t4);
    			append_dev(div0, select);
    			append_dev(select, option);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(select, null);
    				}
    			}

    			select_option(select, /*selectedPool*/ ctx[0], true);
    			append_dev(div4, t6);
    			append_dev(div4, div1);
    			append_dev(div1, button0);
    			append_dev(div4, t8);
    			append_dev(div4, div2);
    			append_dev(div2, label1);
    			append_dev(div2, t10);
    			append_dev(div2, input1);
    			set_input_value(input1, /*toAmount*/ ctx[5]);
    			append_dev(div4, t11);
    			append_dev(div4, div3);
    			append_dev(div3, label2);
    			append_dev(div3, t13);
    			append_dev(div3, input2);
    			set_input_value(input2, /*slippageTolerance*/ ctx[8]);
    			append_dev(div4, t14);
    			if (if_block0) if_block0.m(div4, null);
    			append_dev(div4, t15);
    			if (if_block1) if_block1.m(div4, null);
    			append_dev(div4, t16);
    			if (if_block2) if_block2.m(div4, null);
    			append_dev(div4, t17);
    			append_dev(div4, button1);
    			append_dev(button1, t18);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[12]),
    					listen_dev(select, "change", /*select_change_handler*/ ctx[13]),
    					listen_dev(button0, "click", /*switchTokens*/ ctx[11], false, false, false, false),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[14]),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[15]),
    					listen_dev(button1, "click", /*handleSwap*/ ctx[10], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*fromAmount*/ 4 && to_number(input0.value) !== /*fromAmount*/ ctx[2]) {
    				set_input_value(input0, /*fromAmount*/ ctx[2]);
    			}

    			if (dirty & /*availablePools*/ 512) {
    				each_value = /*availablePools*/ ctx[9];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(select, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*selectedPool, availablePools*/ 513) {
    				select_option(select, /*selectedPool*/ ctx[0]);
    			}

    			if (dirty & /*toAmount*/ 32 && to_number(input1.value) !== /*toAmount*/ ctx[5]) {
    				set_input_value(input1, /*toAmount*/ ctx[5]);
    			}

    			if (dirty & /*slippageTolerance*/ 256 && to_number(input2.value) !== /*slippageTolerance*/ ctx[8]) {
    				set_input_value(input2, /*slippageTolerance*/ ctx[8]);
    			}

    			if (/*quote*/ ctx[3]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_2$2(ctx);
    					if_block0.c();
    					if_block0.m(div4, t15);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*error*/ ctx[6]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_1$3(ctx);
    					if_block1.c();
    					if_block1.m(div4, t16);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*success*/ ctx[7]) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block$3(ctx);
    					if_block2.c();
    					if_block2.m(div4, t17);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (dirty & /*loading*/ 16 && t18_value !== (t18_value = (/*loading*/ ctx[4] ? 'Swapping...' : 'Swap') + "")) set_data_dev(t18, t18_value);

    			if (dirty & /*loading, quote, wallet*/ 26 && button1_disabled_value !== (button1_disabled_value = /*loading*/ ctx[4] || !/*quote*/ ctx[3] || !/*wallet*/ ctx[1])) {
    				prop_dev(button1, "disabled", button1_disabled_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div5);
    			destroy_each(each_blocks, detaching);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('SwapComponent', slots, []);
    	let { wallet } = $$props;
    	let { selectedPool = '' } = $$props;
    	let fromAmount = '';
    	let toAmount = '';
    	let quote = null;
    	let loading = false;
    	let error = '';
    	let success = '';
    	let slippageTolerance = DEFAULT_SLIPPAGE_TOLERANCE;

    	// Available pools (would be loaded dynamically in a real app)
    	let availablePools = [
    		{
    			id: 'pool1',
    			name: 'SUI/USDC',
    			coinA: COMMON_COIN_TYPES.SUI,
    			coinB: COMMON_COIN_TYPES.USDC
    		},
    		{
    			id: 'pool2',
    			name: 'USDC/USDT',
    			coinA: COMMON_COIN_TYPES.USDC,
    			coinB: COMMON_COIN_TYPES.USDT
    		}
    	];

    	let quoteTimeout;

    	function debounceGetQuote() {
    		clearTimeout(quoteTimeout);

    		quoteTimeout = setTimeout(
    			async () => {
    				try {
    					$$invalidate(6, error = '');
    					const amountInWei = parseFloat(fromAmount) * 1e9;

    					if (amountInWei > 0) {
    						$$invalidate(3, quote = await getSwapQuote(selectedPool, amountInWei, true));
    					}
    				} catch(err) {
    					$$invalidate(6, error = `Failed to get quote: ${err.message}`);
    					$$invalidate(3, quote = null);
    				}
    			},
    			500
    		);
    	}

    	async function handleSwap() {
    		if (!wallet || !quote || !selectedPool) return;
    		$$invalidate(4, loading = true);
    		$$invalidate(6, error = '');
    		$$invalidate(7, success = '');

    		try {
    			const amountIn = parseFloat(fromAmount) * 1e9;
    			const minAmountOut = calculateMinAmountWithSlippage(quote.amountOut, slippageTolerance);

    			// Check price impact
    			if (quote.priceImpact > 5) {
    				const confirmed = confirm(`High price impact (${quote.priceImpact.toFixed(2)}%). Continue?`);

    				if (!confirmed) {
    					$$invalidate(4, loading = false);
    					return;
    				}
    			}

    			const selectedPoolInfo = availablePools.find(p => p.id === selectedPool);
    			const result = await swapExactAForB(selectedPool, selectedPoolInfo.coinA, selectedPoolInfo.coinB, 'coinAId', amountIn, minAmountOut, wallet.signer); // Would need actual coin object ID

    			if (result.success) {
    				$$invalidate(7, success = 'Swap successful!');
    				$$invalidate(2, fromAmount = '');
    				$$invalidate(5, toAmount = '');
    				$$invalidate(3, quote = null);
    			} else {
    				$$invalidate(6, error = `Swap failed: ${result.error}`);
    			}
    		} catch(err) {
    			$$invalidate(6, error = handleTransactionError(err));
    		} finally {
    			$$invalidate(4, loading = false);
    		}
    	}

    	function switchTokens() {
    		$$invalidate(2, [fromAmount, toAmount] = [toAmount, fromAmount], fromAmount, ($$invalidate(5, toAmount), $$invalidate(3, quote)));
    	} // Would also need to switch the selected pool direction

    	$$self.$$.on_mount.push(function () {
    		if (wallet === undefined && !('wallet' in $$props || $$self.$$.bound[$$self.$$.props['wallet']])) {
    			console.warn("<SwapComponent> was created without expected prop 'wallet'");
    		}
    	});

    	const writable_props = ['wallet', 'selectedPool'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<SwapComponent> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		fromAmount = to_number(this.value);
    		$$invalidate(2, fromAmount);
    	}

    	function select_change_handler() {
    		selectedPool = select_value(this);
    		$$invalidate(0, selectedPool);
    		$$invalidate(9, availablePools);
    	}

    	function input1_input_handler() {
    		toAmount = to_number(this.value);
    		($$invalidate(5, toAmount), $$invalidate(3, quote));
    	}

    	function input2_input_handler() {
    		slippageTolerance = to_number(this.value);
    		$$invalidate(8, slippageTolerance);
    	}

    	$$self.$$set = $$props => {
    		if ('wallet' in $$props) $$invalidate(1, wallet = $$props.wallet);
    		if ('selectedPool' in $$props) $$invalidate(0, selectedPool = $$props.selectedPool);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		swapExactAForB,
    		getSwapQuote,
    		calculateMinAmountWithSlippage,
    		handleTransactionError,
    		COMMON_COIN_TYPES,
    		DEFAULT_SLIPPAGE_TOLERANCE,
    		wallet,
    		selectedPool,
    		fromAmount,
    		toAmount,
    		quote,
    		loading,
    		error,
    		success,
    		slippageTolerance,
    		availablePools,
    		quoteTimeout,
    		debounceGetQuote,
    		handleSwap,
    		switchTokens
    	});

    	$$self.$inject_state = $$props => {
    		if ('wallet' in $$props) $$invalidate(1, wallet = $$props.wallet);
    		if ('selectedPool' in $$props) $$invalidate(0, selectedPool = $$props.selectedPool);
    		if ('fromAmount' in $$props) $$invalidate(2, fromAmount = $$props.fromAmount);
    		if ('toAmount' in $$props) $$invalidate(5, toAmount = $$props.toAmount);
    		if ('quote' in $$props) $$invalidate(3, quote = $$props.quote);
    		if ('loading' in $$props) $$invalidate(4, loading = $$props.loading);
    		if ('error' in $$props) $$invalidate(6, error = $$props.error);
    		if ('success' in $$props) $$invalidate(7, success = $$props.success);
    		if ('slippageTolerance' in $$props) $$invalidate(8, slippageTolerance = $$props.slippageTolerance);
    		if ('availablePools' in $$props) $$invalidate(9, availablePools = $$props.availablePools);
    		if ('quoteTimeout' in $$props) quoteTimeout = $$props.quoteTimeout;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*fromAmount, selectedPool, loading*/ 21) {
    			// Get quote when input changes
    			if (fromAmount && selectedPool && !loading) {
    				debounceGetQuote();
    			}
    		}

    		if ($$self.$$.dirty & /*quote*/ 8) {
    			// Update output amount when quote changes
    			if (quote) {
    				$$invalidate(5, toAmount = (quote.amountOut / 1e9).toFixed(6));
    			}
    		}
    	};

    	return [
    		selectedPool,
    		wallet,
    		fromAmount,
    		quote,
    		loading,
    		toAmount,
    		error,
    		success,
    		slippageTolerance,
    		availablePools,
    		handleSwap,
    		switchTokens,
    		input0_input_handler,
    		select_change_handler,
    		input1_input_handler,
    		input2_input_handler
    	];
    }

    class SwapComponent extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { wallet: 1, selectedPool: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "SwapComponent",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get wallet() {
    		throw new Error("<SwapComponent>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set wallet(value) {
    		throw new Error("<SwapComponent>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get selectedPool() {
    		throw new Error("<SwapComponent>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set selectedPool(value) {
    		throw new Error("<SwapComponent>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/LiquidityComponent.svelte generated by Svelte v3.59.2 */

    const { console: console_1$1 } = globals;
    const file$2 = "src/components/LiquidityComponent.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[29] = list[i];
    	return child_ctx;
    }

    // (169:8) {#each availablePools as pool}
    function create_each_block$1(ctx) {
    	let option;
    	let t_value = /*pool*/ ctx[29].name + "";
    	let t;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = /*pool*/ ctx[29].id;
    			option.value = option.__value;
    			add_location(option, file$2, 169, 10, 4773);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(169:8) {#each availablePools as pool}",
    		ctx
    	});

    	return block;
    }

    // (176:2) {#if selectedPool && poolInfo}
    function create_if_block$2(ctx) {
    	let div5;
    	let h30;
    	let t1;
    	let div4;
    	let div0;
    	let span0;
    	let t3;
    	let span1;
    	let t4_value = (parseInt(/*poolInfo*/ ctx[4].reserveA) / 1e9).toLocaleString() + "";
    	let t4;
    	let t5;
    	let div1;
    	let span2;
    	let t7;
    	let span3;
    	let t8_value = (parseInt(/*poolInfo*/ ctx[4].reserveB) / 1e9).toLocaleString() + "";
    	let t8;
    	let t9;
    	let div2;
    	let span4;
    	let t11;
    	let span5;
    	let t12_value = (parseInt(/*poolInfo*/ ctx[4].totalSupply) / 1e9).toLocaleString() + "";
    	let t12;
    	let t13;
    	let div3;
    	let span6;
    	let t15;
    	let span7;
    	let t16_value = /*poolInfo*/ ctx[4].feeRate / 100 + "";
    	let t16;
    	let t17;
    	let t18;
    	let div10;
    	let h31;
    	let t20;
    	let div9;
    	let div6;
    	let span8;
    	let t22;
    	let span9;
    	let t23_value = (/*userBalanceA*/ ctx[6] / 1e9).toFixed(6) + "";
    	let t23;
    	let t24;
    	let div7;
    	let span10;
    	let t26;
    	let span11;
    	let t27_value = (/*userBalanceB*/ ctx[7] / 1e9).toFixed(6) + "";
    	let t27;
    	let t28;
    	let div8;
    	let span12;
    	let t30;
    	let span13;
    	let t31_value = (/*userLPBalance*/ ctx[5] / 1e9).toFixed(6) + "";
    	let t31;
    	let t32;
    	let div11;
    	let button0;
    	let t34;
    	let button1;
    	let t36;
    	let t37;
    	let t38;
    	let if_block2_anchor;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*activeTab*/ ctx[12] === 'add') return create_if_block_3$1;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);
    	let if_block1 = /*error*/ ctx[10] && create_if_block_2$1(ctx);
    	let if_block2 = /*success*/ ctx[11] && create_if_block_1$2(ctx);

    	const block = {
    		c: function create() {
    			div5 = element("div");
    			h30 = element("h3");
    			h30.textContent = "Pool Statistics";
    			t1 = space();
    			div4 = element("div");
    			div0 = element("div");
    			span0 = element("span");
    			span0.textContent = "Reserve A:";
    			t3 = space();
    			span1 = element("span");
    			t4 = text(t4_value);
    			t5 = space();
    			div1 = element("div");
    			span2 = element("span");
    			span2.textContent = "Reserve B:";
    			t7 = space();
    			span3 = element("span");
    			t8 = text(t8_value);
    			t9 = space();
    			div2 = element("div");
    			span4 = element("span");
    			span4.textContent = "Total Supply:";
    			t11 = space();
    			span5 = element("span");
    			t12 = text(t12_value);
    			t13 = space();
    			div3 = element("div");
    			span6 = element("span");
    			span6.textContent = "Fee Rate:";
    			t15 = space();
    			span7 = element("span");
    			t16 = text(t16_value);
    			t17 = text("%");
    			t18 = space();
    			div10 = element("div");
    			h31 = element("h3");
    			h31.textContent = "Your Balances";
    			t20 = space();
    			div9 = element("div");
    			div6 = element("div");
    			span8 = element("span");
    			span8.textContent = "Token A:";
    			t22 = space();
    			span9 = element("span");
    			t23 = text(t23_value);
    			t24 = space();
    			div7 = element("div");
    			span10 = element("span");
    			span10.textContent = "Token B:";
    			t26 = space();
    			span11 = element("span");
    			t27 = text(t27_value);
    			t28 = space();
    			div8 = element("div");
    			span12 = element("span");
    			span12.textContent = "LP Tokens:";
    			t30 = space();
    			span13 = element("span");
    			t31 = text(t31_value);
    			t32 = space();
    			div11 = element("div");
    			button0 = element("button");
    			button0.textContent = "Add Liquidity";
    			t34 = space();
    			button1 = element("button");
    			button1.textContent = "Remove Liquidity";
    			t36 = space();
    			if_block0.c();
    			t37 = space();
    			if (if_block1) if_block1.c();
    			t38 = space();
    			if (if_block2) if_block2.c();
    			if_block2_anchor = empty();
    			add_location(h30, file$2, 177, 6, 4939);
    			attr_dev(span0, "class", "stat-label svelte-1f2fuzk");
    			add_location(span0, file$2, 180, 10, 5037);
    			attr_dev(span1, "class", "stat-value svelte-1f2fuzk");
    			add_location(span1, file$2, 181, 10, 5090);
    			attr_dev(div0, "class", "stat-item svelte-1f2fuzk");
    			add_location(div0, file$2, 179, 8, 5003);
    			attr_dev(span2, "class", "stat-label svelte-1f2fuzk");
    			add_location(span2, file$2, 184, 10, 5234);
    			attr_dev(span3, "class", "stat-value svelte-1f2fuzk");
    			add_location(span3, file$2, 185, 10, 5287);
    			attr_dev(div1, "class", "stat-item svelte-1f2fuzk");
    			add_location(div1, file$2, 183, 8, 5200);
    			attr_dev(span4, "class", "stat-label svelte-1f2fuzk");
    			add_location(span4, file$2, 188, 10, 5431);
    			attr_dev(span5, "class", "stat-value svelte-1f2fuzk");
    			add_location(span5, file$2, 189, 10, 5487);
    			attr_dev(div2, "class", "stat-item svelte-1f2fuzk");
    			add_location(div2, file$2, 187, 8, 5397);
    			attr_dev(span6, "class", "stat-label svelte-1f2fuzk");
    			add_location(span6, file$2, 192, 10, 5634);
    			attr_dev(span7, "class", "stat-value svelte-1f2fuzk");
    			add_location(span7, file$2, 193, 10, 5686);
    			attr_dev(div3, "class", "stat-item svelte-1f2fuzk");
    			add_location(div3, file$2, 191, 8, 5600);
    			attr_dev(div4, "class", "stats-grid svelte-1f2fuzk");
    			add_location(div4, file$2, 178, 6, 4970);
    			attr_dev(div5, "class", "pool-stats svelte-1f2fuzk");
    			add_location(div5, file$2, 176, 4, 4908);
    			add_location(h31, file$2, 199, 6, 5822);
    			add_location(span8, file$2, 202, 10, 5923);
    			add_location(span9, file$2, 203, 10, 5955);
    			attr_dev(div6, "class", "balance-item svelte-1f2fuzk");
    			add_location(div6, file$2, 201, 8, 5886);
    			add_location(span10, file$2, 206, 10, 6062);
    			add_location(span11, file$2, 207, 10, 6094);
    			attr_dev(div7, "class", "balance-item svelte-1f2fuzk");
    			add_location(div7, file$2, 205, 8, 6025);
    			add_location(span12, file$2, 210, 10, 6201);
    			add_location(span13, file$2, 211, 10, 6235);
    			attr_dev(div8, "class", "balance-item svelte-1f2fuzk");
    			add_location(div8, file$2, 209, 8, 6164);
    			attr_dev(div9, "class", "balance-grid svelte-1f2fuzk");
    			add_location(div9, file$2, 200, 6, 5851);
    			attr_dev(div10, "class", "user-balances svelte-1f2fuzk");
    			add_location(div10, file$2, 198, 4, 5788);
    			attr_dev(button0, "class", "tab-button svelte-1f2fuzk");
    			toggle_class(button0, "active", /*activeTab*/ ctx[12] === 'add');
    			add_location(button0, file$2, 217, 6, 6352);
    			attr_dev(button1, "class", "tab-button svelte-1f2fuzk");
    			toggle_class(button1, "active", /*activeTab*/ ctx[12] === 'remove');
    			add_location(button1, file$2, 224, 6, 6527);
    			attr_dev(div11, "class", "tabs svelte-1f2fuzk");
    			add_location(div11, file$2, 216, 4, 6327);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div5, anchor);
    			append_dev(div5, h30);
    			append_dev(div5, t1);
    			append_dev(div5, div4);
    			append_dev(div4, div0);
    			append_dev(div0, span0);
    			append_dev(div0, t3);
    			append_dev(div0, span1);
    			append_dev(span1, t4);
    			append_dev(div4, t5);
    			append_dev(div4, div1);
    			append_dev(div1, span2);
    			append_dev(div1, t7);
    			append_dev(div1, span3);
    			append_dev(span3, t8);
    			append_dev(div4, t9);
    			append_dev(div4, div2);
    			append_dev(div2, span4);
    			append_dev(div2, t11);
    			append_dev(div2, span5);
    			append_dev(span5, t12);
    			append_dev(div4, t13);
    			append_dev(div4, div3);
    			append_dev(div3, span6);
    			append_dev(div3, t15);
    			append_dev(div3, span7);
    			append_dev(span7, t16);
    			append_dev(span7, t17);
    			insert_dev(target, t18, anchor);
    			insert_dev(target, div10, anchor);
    			append_dev(div10, h31);
    			append_dev(div10, t20);
    			append_dev(div10, div9);
    			append_dev(div9, div6);
    			append_dev(div6, span8);
    			append_dev(div6, t22);
    			append_dev(div6, span9);
    			append_dev(span9, t23);
    			append_dev(div9, t24);
    			append_dev(div9, div7);
    			append_dev(div7, span10);
    			append_dev(div7, t26);
    			append_dev(div7, span11);
    			append_dev(span11, t27);
    			append_dev(div9, t28);
    			append_dev(div9, div8);
    			append_dev(div8, span12);
    			append_dev(div8, t30);
    			append_dev(div8, span13);
    			append_dev(span13, t31);
    			insert_dev(target, t32, anchor);
    			insert_dev(target, div11, anchor);
    			append_dev(div11, button0);
    			append_dev(div11, t34);
    			append_dev(div11, button1);
    			insert_dev(target, t36, anchor);
    			if_block0.m(target, anchor);
    			insert_dev(target, t37, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, t38, anchor);
    			if (if_block2) if_block2.m(target, anchor);
    			insert_dev(target, if_block2_anchor, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*click_handler*/ ctx[20], false, false, false, false),
    					listen_dev(button1, "click", /*click_handler_1*/ ctx[21], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*poolInfo*/ 16 && t4_value !== (t4_value = (parseInt(/*poolInfo*/ ctx[4].reserveA) / 1e9).toLocaleString() + "")) set_data_dev(t4, t4_value);
    			if (dirty[0] & /*poolInfo*/ 16 && t8_value !== (t8_value = (parseInt(/*poolInfo*/ ctx[4].reserveB) / 1e9).toLocaleString() + "")) set_data_dev(t8, t8_value);
    			if (dirty[0] & /*poolInfo*/ 16 && t12_value !== (t12_value = (parseInt(/*poolInfo*/ ctx[4].totalSupply) / 1e9).toLocaleString() + "")) set_data_dev(t12, t12_value);
    			if (dirty[0] & /*poolInfo*/ 16 && t16_value !== (t16_value = /*poolInfo*/ ctx[4].feeRate / 100 + "")) set_data_dev(t16, t16_value);
    			if (dirty[0] & /*userBalanceA*/ 64 && t23_value !== (t23_value = (/*userBalanceA*/ ctx[6] / 1e9).toFixed(6) + "")) set_data_dev(t23, t23_value);
    			if (dirty[0] & /*userBalanceB*/ 128 && t27_value !== (t27_value = (/*userBalanceB*/ ctx[7] / 1e9).toFixed(6) + "")) set_data_dev(t27, t27_value);
    			if (dirty[0] & /*userLPBalance*/ 32 && t31_value !== (t31_value = (/*userLPBalance*/ ctx[5] / 1e9).toFixed(6) + "")) set_data_dev(t31, t31_value);

    			if (dirty[0] & /*activeTab*/ 4096) {
    				toggle_class(button0, "active", /*activeTab*/ ctx[12] === 'add');
    			}

    			if (dirty[0] & /*activeTab*/ 4096) {
    				toggle_class(button1, "active", /*activeTab*/ ctx[12] === 'remove');
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(t37.parentNode, t37);
    				}
    			}

    			if (/*error*/ ctx[10]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_2$1(ctx);
    					if_block1.c();
    					if_block1.m(t38.parentNode, t38);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*success*/ ctx[11]) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block_1$2(ctx);
    					if_block2.c();
    					if_block2.m(if_block2_anchor.parentNode, if_block2_anchor);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div5);
    			if (detaching) detach_dev(t18);
    			if (detaching) detach_dev(div10);
    			if (detaching) detach_dev(t32);
    			if (detaching) detach_dev(div11);
    			if (detaching) detach_dev(t36);
    			if_block0.d(detaching);
    			if (detaching) detach_dev(t37);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(t38);
    			if (if_block2) if_block2.d(detaching);
    			if (detaching) detach_dev(if_block2_anchor);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(176:2) {#if selectedPool && poolInfo}",
    		ctx
    	});

    	return block;
    }

    // (275:4) {:else}
    function create_else_block$1(ctx) {
    	let div2;
    	let h3;
    	let t1;
    	let div1;
    	let label;
    	let t3;
    	let div0;
    	let input;
    	let t4;
    	let button0;
    	let t6;
    	let button1;
    	let t7_value = (/*loading*/ ctx[9] ? 'Removing...' : 'Remove Liquidity') + "";
    	let t7;
    	let button1_disabled_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			h3 = element("h3");
    			h3.textContent = "Remove Liquidity";
    			t1 = space();
    			div1 = element("div");
    			label = element("label");
    			label.textContent = "LP Token Amount";
    			t3 = space();
    			div0 = element("div");
    			input = element("input");
    			t4 = space();
    			button0 = element("button");
    			button0.textContent = "MAX";
    			t6 = space();
    			button1 = element("button");
    			t7 = text(t7_value);
    			add_location(h3, file$2, 276, 8, 8016);
    			add_location(label, file$2, 279, 10, 8095);
    			attr_dev(input, "type", "number");
    			attr_dev(input, "placeholder", "LP token amount");
    			attr_dev(input, "step", "0.000001");
    			attr_dev(input, "min", "0");
    			attr_dev(input, "class", "svelte-1f2fuzk");
    			add_location(input, file$2, 281, 12, 8177);
    			attr_dev(button0, "type", "button");
    			attr_dev(button0, "class", "max-btn svelte-1f2fuzk");
    			add_location(button0, file$2, 288, 12, 8380);
    			attr_dev(div0, "class", "input-with-max svelte-1f2fuzk");
    			add_location(div0, file$2, 280, 10, 8136);
    			attr_dev(div1, "class", "input-group");
    			add_location(div1, file$2, 278, 8, 8059);
    			button1.disabled = button1_disabled_value = /*loading*/ ctx[9] || !/*liquidityToRemove*/ ctx[8] || !/*wallet*/ ctx[1];
    			attr_dev(button1, "class", "primary-button remove-btn svelte-1f2fuzk");
    			add_location(button1, file$2, 298, 8, 8627);
    			attr_dev(div2, "class", "liquidity-form svelte-1f2fuzk");
    			add_location(div2, file$2, 275, 6, 7979);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, h3);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			append_dev(div1, label);
    			append_dev(div1, t3);
    			append_dev(div1, div0);
    			append_dev(div0, input);
    			set_input_value(input, /*liquidityToRemove*/ ctx[8]);
    			append_dev(div0, t4);
    			append_dev(div0, button0);
    			append_dev(div2, t6);
    			append_dev(div2, button1);
    			append_dev(button1, t7);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[24]),
    					listen_dev(button0, "click", /*click_handler_2*/ ctx[25], false, false, false, false),
    					listen_dev(button1, "click", /*handleRemoveLiquidity*/ ctx[15], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*liquidityToRemove*/ 256 && to_number(input.value) !== /*liquidityToRemove*/ ctx[8]) {
    				set_input_value(input, /*liquidityToRemove*/ ctx[8]);
    			}

    			if (dirty[0] & /*loading*/ 512 && t7_value !== (t7_value = (/*loading*/ ctx[9] ? 'Removing...' : 'Remove Liquidity') + "")) set_data_dev(t7, t7_value);

    			if (dirty[0] & /*loading, liquidityToRemove, wallet*/ 770 && button1_disabled_value !== (button1_disabled_value = /*loading*/ ctx[9] || !/*liquidityToRemove*/ ctx[8] || !/*wallet*/ ctx[1])) {
    				prop_dev(button1, "disabled", button1_disabled_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(275:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (234:4) {#if activeTab === 'add'}
    function create_if_block_3$1(ctx) {
    	let div4;
    	let h3;
    	let t1;
    	let div1;
    	let label0;
    	let t3;
    	let div0;
    	let input0;
    	let t4;
    	let button0;
    	let t6;
    	let div3;
    	let label1;
    	let t8;
    	let div2;
    	let input1;
    	let t9;
    	let button1;
    	let t11;
    	let button2;
    	let t12_value = (/*loading*/ ctx[9] ? 'Adding...' : 'Add Liquidity') + "";
    	let t12;
    	let button2_disabled_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			h3 = element("h3");
    			h3.textContent = "Add Liquidity";
    			t1 = space();
    			div1 = element("div");
    			label0 = element("label");
    			label0.textContent = "Token A Amount";
    			t3 = space();
    			div0 = element("div");
    			input0 = element("input");
    			t4 = space();
    			button0 = element("button");
    			button0.textContent = "MAX";
    			t6 = space();
    			div3 = element("div");
    			label1 = element("label");
    			label1.textContent = "Token B Amount";
    			t8 = space();
    			div2 = element("div");
    			input1 = element("input");
    			t9 = space();
    			button1 = element("button");
    			button1.textContent = "MAX";
    			t11 = space();
    			button2 = element("button");
    			t12 = text(t12_value);
    			add_location(h3, file$2, 235, 8, 6790);
    			add_location(label0, file$2, 238, 10, 6866);
    			attr_dev(input0, "type", "number");
    			attr_dev(input0, "placeholder", "Token A amount");
    			attr_dev(input0, "step", "0.000001");
    			attr_dev(input0, "min", "0");
    			attr_dev(input0, "class", "svelte-1f2fuzk");
    			add_location(input0, file$2, 240, 12, 6947);
    			attr_dev(button0, "type", "button");
    			attr_dev(button0, "class", "max-btn svelte-1f2fuzk");
    			add_location(button0, file$2, 248, 12, 7179);
    			attr_dev(div0, "class", "input-with-max svelte-1f2fuzk");
    			add_location(div0, file$2, 239, 10, 6906);
    			attr_dev(div1, "class", "input-group");
    			add_location(div1, file$2, 237, 8, 6830);
    			add_location(label1, file$2, 253, 10, 7332);
    			attr_dev(input1, "type", "number");
    			attr_dev(input1, "placeholder", "Token B amount");
    			attr_dev(input1, "step", "0.000001");
    			attr_dev(input1, "min", "0");
    			attr_dev(input1, "class", "svelte-1f2fuzk");
    			add_location(input1, file$2, 255, 12, 7413);
    			attr_dev(button1, "type", "button");
    			attr_dev(button1, "class", "max-btn svelte-1f2fuzk");
    			add_location(button1, file$2, 262, 12, 7605);
    			attr_dev(div2, "class", "input-with-max svelte-1f2fuzk");
    			add_location(div2, file$2, 254, 10, 7372);
    			attr_dev(div3, "class", "input-group");
    			add_location(div3, file$2, 252, 8, 7296);
    			button2.disabled = button2_disabled_value = /*loading*/ ctx[9] || !/*amountA*/ ctx[2] || !/*amountB*/ ctx[3] || !/*wallet*/ ctx[1];
    			attr_dev(button2, "class", "primary-button");
    			add_location(button2, file$2, 266, 8, 7722);
    			attr_dev(div4, "class", "liquidity-form svelte-1f2fuzk");
    			add_location(div4, file$2, 234, 6, 6753);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, h3);
    			append_dev(div4, t1);
    			append_dev(div4, div1);
    			append_dev(div1, label0);
    			append_dev(div1, t3);
    			append_dev(div1, div0);
    			append_dev(div0, input0);
    			set_input_value(input0, /*amountA*/ ctx[2]);
    			append_dev(div0, t4);
    			append_dev(div0, button0);
    			append_dev(div4, t6);
    			append_dev(div4, div3);
    			append_dev(div3, label1);
    			append_dev(div3, t8);
    			append_dev(div3, div2);
    			append_dev(div2, input1);
    			set_input_value(input1, /*amountB*/ ctx[3]);
    			append_dev(div2, t9);
    			append_dev(div2, button1);
    			append_dev(div4, t11);
    			append_dev(div4, button2);
    			append_dev(button2, t12);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[22]),
    					listen_dev(input0, "input", /*calculateRatio*/ ctx[16], false, false, false, false),
    					listen_dev(button0, "click", /*setMaxAmountA*/ ctx[17], false, false, false, false),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[23]),
    					listen_dev(button1, "click", /*setMaxAmountB*/ ctx[18], false, false, false, false),
    					listen_dev(button2, "click", /*handleAddLiquidity*/ ctx[14], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*amountA*/ 4 && to_number(input0.value) !== /*amountA*/ ctx[2]) {
    				set_input_value(input0, /*amountA*/ ctx[2]);
    			}

    			if (dirty[0] & /*amountB*/ 8 && to_number(input1.value) !== /*amountB*/ ctx[3]) {
    				set_input_value(input1, /*amountB*/ ctx[3]);
    			}

    			if (dirty[0] & /*loading*/ 512 && t12_value !== (t12_value = (/*loading*/ ctx[9] ? 'Adding...' : 'Add Liquidity') + "")) set_data_dev(t12, t12_value);

    			if (dirty[0] & /*loading, amountA, amountB, wallet*/ 526 && button2_disabled_value !== (button2_disabled_value = /*loading*/ ctx[9] || !/*amountA*/ ctx[2] || !/*amountB*/ ctx[3] || !/*wallet*/ ctx[1])) {
    				prop_dev(button2, "disabled", button2_disabled_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3$1.name,
    		type: "if",
    		source: "(234:4) {#if activeTab === 'add'}",
    		ctx
    	});

    	return block;
    }

    // (309:4) {#if error}
    function create_if_block_2$1(ctx) {
    	let div;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(/*error*/ ctx[10]);
    			attr_dev(div, "class", "error");
    			add_location(div, file$2, 309, 6, 8916);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*error*/ 1024) set_data_dev(t, /*error*/ ctx[10]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$1.name,
    		type: "if",
    		source: "(309:4) {#if error}",
    		ctx
    	});

    	return block;
    }

    // (313:4) {#if success}
    function create_if_block_1$2(ctx) {
    	let div;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(/*success*/ ctx[11]);
    			attr_dev(div, "class", "success");
    			add_location(div, file$2, 313, 6, 8984);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*success*/ 2048) set_data_dev(t, /*success*/ ctx[11]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$2.name,
    		type: "if",
    		source: "(313:4) {#if success}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div2;
    	let h2;
    	let t1;
    	let div1;
    	let div0;
    	let label;
    	let t3;
    	let select;
    	let option;
    	let t5;
    	let mounted;
    	let dispose;
    	let each_value = /*availablePools*/ ctx[13];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	let if_block = /*selectedPool*/ ctx[0] && /*poolInfo*/ ctx[4] && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			h2 = element("h2");
    			h2.textContent = "Liquidity Management";
    			t1 = space();
    			div1 = element("div");
    			div0 = element("div");
    			label = element("label");
    			label.textContent = "Select Pool";
    			t3 = space();
    			select = element("select");
    			option = element("option");
    			option.textContent = "Select trading pair";

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t5 = space();
    			if (if_block) if_block.c();
    			add_location(h2, file$2, 161, 2, 4503);
    			add_location(label, file$2, 165, 6, 4602);
    			option.__value = "";
    			option.value = option.__value;
    			add_location(option, file$2, 167, 8, 4678);
    			if (/*selectedPool*/ ctx[0] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[19].call(select));
    			add_location(select, file$2, 166, 6, 4635);
    			attr_dev(div0, "class", "input-group");
    			add_location(div0, file$2, 164, 4, 4570);
    			attr_dev(div1, "class", "pool-selector svelte-1f2fuzk");
    			add_location(div1, file$2, 163, 2, 4538);
    			attr_dev(div2, "class", "card");
    			add_location(div2, file$2, 160, 0, 4482);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, h2);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div0, label);
    			append_dev(div0, t3);
    			append_dev(div0, select);
    			append_dev(select, option);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(select, null);
    				}
    			}

    			select_option(select, /*selectedPool*/ ctx[0], true);
    			append_dev(div2, t5);
    			if (if_block) if_block.m(div2, null);

    			if (!mounted) {
    				dispose = listen_dev(select, "change", /*select_change_handler*/ ctx[19]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*availablePools*/ 8192) {
    				each_value = /*availablePools*/ ctx[13];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(select, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty[0] & /*selectedPool, availablePools*/ 8193) {
    				select_option(select, /*selectedPool*/ ctx[0]);
    			}

    			if (/*selectedPool*/ ctx[0] && /*poolInfo*/ ctx[4]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$2(ctx);
    					if_block.c();
    					if_block.m(div2, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_each(each_blocks, detaching);
    			if (if_block) if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let selectedPoolInfo;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('LiquidityComponent', slots, []);
    	let { wallet } = $$props;
    	let { selectedPool = '' } = $$props;
    	let amountA = '';
    	let amountB = '';
    	let poolInfo = null;
    	let userLPBalance = 0;
    	let userBalanceA = 0;
    	let userBalanceB = 0;
    	let liquidityToRemove = '';
    	let loading = false;
    	let error = '';
    	let success = '';
    	let activeTab = 'add'; // 'add' or 'remove'

    	// Available pools
    	let availablePools = [
    		{
    			id: 'pool1',
    			name: 'SUI/USDC',
    			coinA: COMMON_COIN_TYPES.SUI,
    			coinB: COMMON_COIN_TYPES.USDC
    		},
    		{
    			id: 'pool2',
    			name: 'USDC/USDT',
    			coinA: COMMON_COIN_TYPES.USDC,
    			coinB: COMMON_COIN_TYPES.USDT
    		}
    	];

    	async function loadPoolInfo() {
    		try {
    			$$invalidate(4, poolInfo = await getPoolInfo(selectedPool));
    		} catch(err) {
    			console.error('Failed to load pool info:', err);
    		}
    	}

    	async function loadUserBalances() {
    		if (!wallet || !selectedPoolInfo) return;

    		try {
    			const balanceA = await getUserBalance(wallet.address, selectedPoolInfo.coinA);
    			const balanceB = await getUserBalance(wallet.address, selectedPoolInfo.coinB);
    			$$invalidate(6, userBalanceA = balanceA.totalBalance);
    			$$invalidate(7, userBalanceB = balanceB.totalBalance);

    			// Load LP balance (simplified - would need actual implementation)
    			$$invalidate(5, userLPBalance = 1000000000); // Example: 1 LP token
    		} catch(err) {
    			console.error('Failed to load balances:', err);
    		}
    	}

    	async function handleAddLiquidity() {
    		if (!wallet || !selectedPool || !selectedPoolInfo) return;
    		$$invalidate(9, loading = true);
    		$$invalidate(10, error = '');
    		$$invalidate(11, success = '');

    		try {
    			const amountAWei = parseFloat(amountA) * 1e9;
    			const amountBWei = parseFloat(amountB) * 1e9;
    			const minAmountAWei = amountAWei * 0.99; // 1% slippage protection
    			const minAmountBWei = amountBWei * 0.99;
    			const result = await addLiquidity(selectedPool, selectedPoolInfo.coinA, selectedPoolInfo.coinB, 'coinAId', 'coinBId', amountAWei, amountBWei, minAmountAWei, minAmountBWei, wallet.signer); // Would need actual coin object IDs

    			if (result.success) {
    				$$invalidate(11, success = 'Liquidity added successfully!');
    				$$invalidate(2, amountA = '');
    				$$invalidate(3, amountB = '');
    				loadUserBalances(); // Refresh balances
    			} else {
    				$$invalidate(10, error = `Add liquidity failed: ${result.error}`);
    			}
    		} catch(err) {
    			$$invalidate(10, error = handleTransactionError(err));
    		} finally {
    			$$invalidate(9, loading = false);
    		}
    	}

    	async function handleRemoveLiquidity() {
    		if (!wallet || !selectedPool || !selectedPoolInfo) return;
    		$$invalidate(9, loading = true);
    		$$invalidate(10, error = '');
    		$$invalidate(11, success = '');

    		try {
    			const liquidityWei = parseFloat(liquidityToRemove) * 1e9;
    			const minAmountA = 0; // Would calculate based on current pool ratio
    			const minAmountB = 0;
    			const result = await removeLiquidity(selectedPool, selectedPoolInfo.coinA, selectedPoolInfo.coinB, 'lpTokenId', liquidityWei, minAmountA, minAmountB, wallet.signer); // Would need actual LP token ID

    			if (result.success) {
    				$$invalidate(11, success = 'Liquidity removed successfully!');
    				$$invalidate(8, liquidityToRemove = '');
    				loadUserBalances(); // Refresh balances
    			} else {
    				$$invalidate(10, error = `Remove liquidity failed: ${result.error}`);
    			}
    		} catch(err) {
    			$$invalidate(10, error = handleTransactionError(err));
    		} finally {
    			$$invalidate(9, loading = false);
    		}
    	}

    	function calculateRatio() {
    		if (!poolInfo || !amountA) return;
    		const ratio = parseInt(poolInfo.reserveB) / parseInt(poolInfo.reserveA);
    		$$invalidate(3, amountB = (parseFloat(amountA) * ratio).toFixed(6));
    	}

    	function setMaxAmountA() {
    		$$invalidate(2, amountA = (userBalanceA / 1e9).toFixed(6));
    		calculateRatio();
    	}

    	function setMaxAmountB() {
    		$$invalidate(3, amountB = (userBalanceB / 1e9).toFixed(6));

    		if (poolInfo && amountB) {
    			const ratio = parseInt(poolInfo.reserveA) / parseInt(poolInfo.reserveB);
    			$$invalidate(2, amountA = (parseFloat(amountB) * ratio).toFixed(6));
    		}
    	}

    	$$self.$$.on_mount.push(function () {
    		if (wallet === undefined && !('wallet' in $$props || $$self.$$.bound[$$self.$$.props['wallet']])) {
    			console_1$1.warn("<LiquidityComponent> was created without expected prop 'wallet'");
    		}
    	});

    	const writable_props = ['wallet', 'selectedPool'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<LiquidityComponent> was created with unknown prop '${key}'`);
    	});

    	function select_change_handler() {
    		selectedPool = select_value(this);
    		$$invalidate(0, selectedPool);
    		$$invalidate(13, availablePools);
    	}

    	const click_handler = () => $$invalidate(12, activeTab = 'add');
    	const click_handler_1 = () => $$invalidate(12, activeTab = 'remove');

    	function input0_input_handler() {
    		amountA = to_number(this.value);
    		$$invalidate(2, amountA);
    	}

    	function input1_input_handler() {
    		amountB = to_number(this.value);
    		$$invalidate(3, amountB);
    	}

    	function input_input_handler() {
    		liquidityToRemove = to_number(this.value);
    		$$invalidate(8, liquidityToRemove);
    	}

    	const click_handler_2 = () => $$invalidate(8, liquidityToRemove = (userLPBalance / 1e9).toFixed(6));

    	$$self.$$set = $$props => {
    		if ('wallet' in $$props) $$invalidate(1, wallet = $$props.wallet);
    		if ('selectedPool' in $$props) $$invalidate(0, selectedPool = $$props.selectedPool);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		addLiquidity,
    		removeLiquidity,
    		getPoolInfo,
    		getUserBalance,
    		handleTransactionError,
    		COMMON_COIN_TYPES,
    		wallet,
    		selectedPool,
    		amountA,
    		amountB,
    		poolInfo,
    		userLPBalance,
    		userBalanceA,
    		userBalanceB,
    		liquidityToRemove,
    		loading,
    		error,
    		success,
    		activeTab,
    		availablePools,
    		loadPoolInfo,
    		loadUserBalances,
    		handleAddLiquidity,
    		handleRemoveLiquidity,
    		calculateRatio,
    		setMaxAmountA,
    		setMaxAmountB,
    		selectedPoolInfo
    	});

    	$$self.$inject_state = $$props => {
    		if ('wallet' in $$props) $$invalidate(1, wallet = $$props.wallet);
    		if ('selectedPool' in $$props) $$invalidate(0, selectedPool = $$props.selectedPool);
    		if ('amountA' in $$props) $$invalidate(2, amountA = $$props.amountA);
    		if ('amountB' in $$props) $$invalidate(3, amountB = $$props.amountB);
    		if ('poolInfo' in $$props) $$invalidate(4, poolInfo = $$props.poolInfo);
    		if ('userLPBalance' in $$props) $$invalidate(5, userLPBalance = $$props.userLPBalance);
    		if ('userBalanceA' in $$props) $$invalidate(6, userBalanceA = $$props.userBalanceA);
    		if ('userBalanceB' in $$props) $$invalidate(7, userBalanceB = $$props.userBalanceB);
    		if ('liquidityToRemove' in $$props) $$invalidate(8, liquidityToRemove = $$props.liquidityToRemove);
    		if ('loading' in $$props) $$invalidate(9, loading = $$props.loading);
    		if ('error' in $$props) $$invalidate(10, error = $$props.error);
    		if ('success' in $$props) $$invalidate(11, success = $$props.success);
    		if ('activeTab' in $$props) $$invalidate(12, activeTab = $$props.activeTab);
    		if ('availablePools' in $$props) $$invalidate(13, availablePools = $$props.availablePools);
    		if ('selectedPoolInfo' in $$props) selectedPoolInfo = $$props.selectedPoolInfo;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*selectedPool*/ 1) {
    			selectedPoolInfo = availablePools.find(p => p.id === selectedPool);
    		}

    		if ($$self.$$.dirty[0] & /*selectedPool, wallet*/ 3) {
    			// Load pool info when selected pool changes
    			if (selectedPool && wallet) {
    				loadPoolInfo();
    				loadUserBalances();
    			}
    		}
    	};

    	return [
    		selectedPool,
    		wallet,
    		amountA,
    		amountB,
    		poolInfo,
    		userLPBalance,
    		userBalanceA,
    		userBalanceB,
    		liquidityToRemove,
    		loading,
    		error,
    		success,
    		activeTab,
    		availablePools,
    		handleAddLiquidity,
    		handleRemoveLiquidity,
    		calculateRatio,
    		setMaxAmountA,
    		setMaxAmountB,
    		select_change_handler,
    		click_handler,
    		click_handler_1,
    		input0_input_handler,
    		input1_input_handler,
    		input_input_handler,
    		click_handler_2
    	];
    }

    class LiquidityComponent extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { wallet: 1, selectedPool: 0 }, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "LiquidityComponent",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get wallet() {
    		throw new Error("<LiquidityComponent>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set wallet(value) {
    		throw new Error("<LiquidityComponent>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get selectedPool() {
    		throw new Error("<LiquidityComponent>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set selectedPool(value) {
    		throw new Error("<LiquidityComponent>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/TransactionMonitor.svelte generated by Svelte v3.59.2 */
    const file$1 = "src/components/TransactionMonitor.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[11] = list[i];
    	return child_ctx;
    }

    // (94:0) {#if visible}
    function create_if_block$1(ctx) {
    	let div3;
    	let div1;
    	let h3;
    	let t1;
    	let div0;
    	let button0;
    	let t2;
    	let button0_disabled_value;
    	let t3;
    	let button1;
    	let t4;
    	let button1_disabled_value;
    	let t5;
    	let button2;
    	let t7;
    	let div2;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*transactions*/ ctx[1].length === 0) return create_if_block_1$1;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div1 = element("div");
    			h3 = element("h3");
    			h3.textContent = "Transaction Monitor";
    			t1 = space();
    			div0 = element("div");
    			button0 = element("button");
    			t2 = text("Clear Completed");
    			t3 = space();
    			button1 = element("button");
    			t4 = text("Clear All");
    			t5 = space();
    			button2 = element("button");
    			button2.textContent = "×";
    			t7 = space();
    			div2 = element("div");
    			if_block.c();
    			attr_dev(h3, "class", "svelte-1vi4z26");
    			add_location(h3, file$1, 96, 6, 2464);
    			attr_dev(button0, "class", "clear-btn svelte-1vi4z26");
    			button0.disabled = button0_disabled_value = /*transactions*/ ctx[1].filter(func).length === 0;
    			add_location(button0, file$1, 98, 8, 2538);
    			attr_dev(button1, "class", "clear-btn danger svelte-1vi4z26");
    			button1.disabled = button1_disabled_value = /*transactions*/ ctx[1].length === 0;
    			add_location(button1, file$1, 105, 8, 2770);
    			attr_dev(button2, "class", "close-btn svelte-1vi4z26");
    			add_location(button2, file$1, 112, 8, 2959);
    			attr_dev(div0, "class", "monitor-controls svelte-1vi4z26");
    			add_location(div0, file$1, 97, 6, 2499);
    			attr_dev(div1, "class", "monitor-header svelte-1vi4z26");
    			add_location(div1, file$1, 95, 4, 2429);
    			attr_dev(div2, "class", "transaction-list svelte-1vi4z26");
    			add_location(div2, file$1, 116, 4, 3058);
    			attr_dev(div3, "class", "transaction-monitor svelte-1vi4z26");
    			add_location(div3, file$1, 94, 2, 2391);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div1);
    			append_dev(div1, h3);
    			append_dev(div1, t1);
    			append_dev(div1, div0);
    			append_dev(div0, button0);
    			append_dev(button0, t2);
    			append_dev(div0, t3);
    			append_dev(div0, button1);
    			append_dev(button1, t4);
    			append_dev(div0, t5);
    			append_dev(div0, button2);
    			append_dev(div3, t7);
    			append_dev(div3, div2);
    			if_block.m(div2, null);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*clearCompletedTransactions*/ ctx[2], false, false, false, false),
    					listen_dev(button1, "click", /*clearAllTransactions*/ ctx[3], false, false, false, false),
    					listen_dev(button2, "click", /*click_handler*/ ctx[5], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*transactions*/ 2 && button0_disabled_value !== (button0_disabled_value = /*transactions*/ ctx[1].filter(func).length === 0)) {
    				prop_dev(button0, "disabled", button0_disabled_value);
    			}

    			if (dirty & /*transactions*/ 2 && button1_disabled_value !== (button1_disabled_value = /*transactions*/ ctx[1].length === 0)) {
    				prop_dev(button1, "disabled", button1_disabled_value);
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div2, null);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(94:0) {#if visible}",
    		ctx
    	});

    	return block;
    }

    // (122:6) {:else}
    function create_else_block(ctx) {
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let each_1_anchor;
    	let each_value = /*transactions*/ ctx[1];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*tx*/ ctx[11].id;
    	validate_each_keys(ctx, each_value, get_each_context, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(target, anchor);
    				}
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*transactions, openInExplorer, copyToClipboard, formatTxHash, formatTime*/ 2) {
    				each_value = /*transactions*/ ctx[1];
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, each_1_anchor.parentNode, destroy_block, create_each_block, each_1_anchor, get_each_context);
    			}
    		},
    		d: function destroy(detaching) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(122:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (118:6) {#if transactions.length === 0}
    function create_if_block_1$1(ctx) {
    	let div;
    	let p;

    	const block = {
    		c: function create() {
    			div = element("div");
    			p = element("p");
    			p.textContent = "No transactions to monitor";
    			add_location(p, file$1, 119, 10, 3171);
    			attr_dev(div, "class", "empty-state svelte-1vi4z26");
    			add_location(div, file$1, 118, 8, 3135);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, p);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(118:6) {#if transactions.length === 0}",
    		ctx
    	});

    	return block;
    }

    // (133:49) 
    function create_if_block_5(ctx) {
    	let div;
    	let t1;
    	let span;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "❌";
    			t1 = space();
    			span = element("span");
    			span.textContent = "Failed";
    			attr_dev(div, "class", "status-indicator failed svelte-1vi4z26");
    			add_location(div, file$1, 133, 18, 3949);
    			attr_dev(span, "class", "status-text svelte-1vi4z26");
    			add_location(span, file$1, 134, 18, 4012);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, span, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(133:49) ",
    		ctx
    	});

    	return block;
    }

    // (130:52) 
    function create_if_block_4(ctx) {
    	let div;
    	let t1;
    	let span;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "✅";
    			t1 = space();
    			span = element("span");
    			span.textContent = "Confirmed";
    			attr_dev(div, "class", "status-indicator confirmed svelte-1vi4z26");
    			add_location(div, file$1, 130, 18, 3772);
    			attr_dev(span, "class", "status-text svelte-1vi4z26");
    			add_location(span, file$1, 131, 18, 3838);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, span, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(130:52) ",
    		ctx
    	});

    	return block;
    }

    // (127:16) {#if tx.status === 'pending'}
    function create_if_block_3(ctx) {
    	let div;
    	let t1;
    	let span;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "⏳";
    			t1 = space();
    			span = element("span");
    			span.textContent = "Pending";
    			attr_dev(div, "class", "status-indicator pending svelte-1vi4z26");
    			add_location(div, file$1, 127, 18, 3596);
    			attr_dev(span, "class", "status-text svelte-1vi4z26");
    			add_location(span, file$1, 128, 18, 3660);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, span, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(127:16) {#if tx.status === 'pending'}",
    		ctx
    	});

    	return block;
    }

    // (167:14) {#if tx.error}
    function create_if_block_2(ctx) {
    	let div;
    	let strong;
    	let t1;
    	let t2_value = /*tx*/ ctx[11].error + "";
    	let t2;

    	const block = {
    		c: function create() {
    			div = element("div");
    			strong = element("strong");
    			strong.textContent = "Error:";
    			t1 = space();
    			t2 = text(t2_value);
    			add_location(strong, file$1, 168, 18, 5147);
    			attr_dev(div, "class", "transaction-error svelte-1vi4z26");
    			add_location(div, file$1, 167, 16, 5097);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, strong);
    			append_dev(div, t1);
    			append_dev(div, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*transactions*/ 2 && t2_value !== (t2_value = /*tx*/ ctx[11].error + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(167:14) {#if tx.error}",
    		ctx
    	});

    	return block;
    }

    // (123:8) {#each transactions as tx (tx.id)}
    function create_each_block(key_1, ctx) {
    	let div6;
    	let div2;
    	let div0;
    	let t0;
    	let div1;
    	let t1_value = formatTime(/*tx*/ ctx[11].timestamp) + "";
    	let t1;
    	let t2;
    	let div5;
    	let div3;
    	let t3_value = /*tx*/ ctx[11].description + "";
    	let t3;
    	let t4;
    	let div4;
    	let span;
    	let t6;
    	let code;
    	let t7_value = formatTxHash(/*tx*/ ctx[11].digest) + "";
    	let t7;
    	let t8;
    	let button0;
    	let t10;
    	let button1;
    	let t12;
    	let t13;
    	let mounted;
    	let dispose;

    	function select_block_type_1(ctx, dirty) {
    		if (/*tx*/ ctx[11].status === 'pending') return create_if_block_3;
    		if (/*tx*/ ctx[11].status === 'confirmed') return create_if_block_4;
    		if (/*tx*/ ctx[11].status === 'failed') return create_if_block_5;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block0 = current_block_type && current_block_type(ctx);

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[6](/*tx*/ ctx[11]);
    	}

    	function click_handler_2() {
    		return /*click_handler_2*/ ctx[7](/*tx*/ ctx[11]);
    	}

    	let if_block1 = /*tx*/ ctx[11].error && create_if_block_2(ctx);

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			div6 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			if (if_block0) if_block0.c();
    			t0 = space();
    			div1 = element("div");
    			t1 = text(t1_value);
    			t2 = space();
    			div5 = element("div");
    			div3 = element("div");
    			t3 = text(t3_value);
    			t4 = space();
    			div4 = element("div");
    			span = element("span");
    			span.textContent = "Tx Hash:";
    			t6 = space();
    			code = element("code");
    			t7 = text(t7_value);
    			t8 = space();
    			button0 = element("button");
    			button0.textContent = "📋";
    			t10 = space();
    			button1 = element("button");
    			button1.textContent = "🔗";
    			t12 = space();
    			if (if_block1) if_block1.c();
    			t13 = space();
    			attr_dev(div0, "class", "transaction-status svelte-1vi4z26");
    			add_location(div0, file$1, 125, 14, 3499);
    			attr_dev(div1, "class", "transaction-time svelte-1vi4z26");
    			add_location(div1, file$1, 137, 14, 4109);
    			attr_dev(div2, "class", "transaction-header svelte-1vi4z26");
    			add_location(div2, file$1, 124, 12, 3452);
    			attr_dev(div3, "class", "transaction-description svelte-1vi4z26");
    			add_location(div3, file$1, 143, 14, 4284);
    			attr_dev(span, "class", "hash-label svelte-1vi4z26");
    			add_location(span, file$1, 148, 16, 4452);
    			attr_dev(code, "class", "hash-value svelte-1vi4z26");
    			add_location(code, file$1, 149, 16, 4509);
    			attr_dev(button0, "class", "hash-action svelte-1vi4z26");
    			attr_dev(button0, "title", "Copy full hash");
    			add_location(button0, file$1, 150, 16, 4583);
    			attr_dev(button1, "class", "hash-action svelte-1vi4z26");
    			attr_dev(button1, "title", "View in explorer");
    			add_location(button1, file$1, 157, 16, 4814);
    			attr_dev(div4, "class", "transaction-hash svelte-1vi4z26");
    			add_location(div4, file$1, 147, 14, 4405);
    			attr_dev(div5, "class", "transaction-details");
    			add_location(div5, file$1, 142, 12, 4236);
    			attr_dev(div6, "class", "transaction-item svelte-1vi4z26");
    			toggle_class(div6, "pending", /*tx*/ ctx[11].status === 'pending');
    			toggle_class(div6, "confirmed", /*tx*/ ctx[11].status === 'confirmed');
    			toggle_class(div6, "failed", /*tx*/ ctx[11].status === 'failed');
    			add_location(div6, file$1, 123, 10, 3287);
    			this.first = div6;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div6, anchor);
    			append_dev(div6, div2);
    			append_dev(div2, div0);
    			if (if_block0) if_block0.m(div0, null);
    			append_dev(div2, t0);
    			append_dev(div2, div1);
    			append_dev(div1, t1);
    			append_dev(div6, t2);
    			append_dev(div6, div5);
    			append_dev(div5, div3);
    			append_dev(div3, t3);
    			append_dev(div5, t4);
    			append_dev(div5, div4);
    			append_dev(div4, span);
    			append_dev(div4, t6);
    			append_dev(div4, code);
    			append_dev(code, t7);
    			append_dev(div4, t8);
    			append_dev(div4, button0);
    			append_dev(div4, t10);
    			append_dev(div4, button1);
    			append_dev(div5, t12);
    			if (if_block1) if_block1.m(div5, null);
    			append_dev(div6, t13);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", click_handler_1, false, false, false, false),
    					listen_dev(button1, "click", click_handler_2, false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (current_block_type !== (current_block_type = select_block_type_1(ctx))) {
    				if (if_block0) if_block0.d(1);
    				if_block0 = current_block_type && current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div0, null);
    				}
    			}

    			if (dirty & /*transactions*/ 2 && t1_value !== (t1_value = formatTime(/*tx*/ ctx[11].timestamp) + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*transactions*/ 2 && t3_value !== (t3_value = /*tx*/ ctx[11].description + "")) set_data_dev(t3, t3_value);
    			if (dirty & /*transactions*/ 2 && t7_value !== (t7_value = formatTxHash(/*tx*/ ctx[11].digest) + "")) set_data_dev(t7, t7_value);

    			if (/*tx*/ ctx[11].error) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_2(ctx);
    					if_block1.c();
    					if_block1.m(div5, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty & /*transactions*/ 2) {
    				toggle_class(div6, "pending", /*tx*/ ctx[11].status === 'pending');
    			}

    			if (dirty & /*transactions*/ 2) {
    				toggle_class(div6, "confirmed", /*tx*/ ctx[11].status === 'confirmed');
    			}

    			if (dirty & /*transactions*/ 2) {
    				toggle_class(div6, "failed", /*tx*/ ctx[11].status === 'failed');
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div6);

    			if (if_block0) {
    				if_block0.d();
    			}

    			if (if_block1) if_block1.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(123:8) {#each transactions as tx (tx.id)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let if_block_anchor;
    	let if_block = /*visible*/ ctx[0] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*visible*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function formatTime(timestamp) {
    	return timestamp.toLocaleTimeString();
    }

    function formatTxHash(hash) {
    	return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
    }

    function copyToClipboard(text) {
    	navigator.clipboard?.writeText(text);
    }

    function openInExplorer(digest) {
    	// Sui testnet explorer
    	const url = `https://suiexplorer.com/txblock/${digest}?network=testnet`;

    	window.open(url, '_blank');
    }

    const func = tx => tx.status !== 'pending';

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('TransactionMonitor', slots, []);
    	let { visible = false } = $$props;
    	let { transactions = [] } = $$props;
    	let intervalId;

    	// Transaction status can be: 'pending', 'confirmed', 'failed'
    	function addTransaction(digest, description) {
    		const transaction = {
    			id: Date.now(),
    			digest,
    			description,
    			status: 'pending',
    			timestamp: new Date(),
    			confirmations: 0,
    			error: null
    		};

    		$$invalidate(1, transactions = [transaction, ...transactions]);
    		return transaction;
    	}

    	function updateTransactionStatus(id, status, error = null, confirmations = 0) {
    		$$invalidate(1, transactions = transactions.map(tx => tx.id === id
    		? { ...tx, status, error, confirmations }
    		: tx));
    	}

    	async function monitorTransaction(transaction) {
    		try {
    			const result = await waitForTransactionConfirmation(transaction.digest);

    			if (result.confirmed) {
    				updateTransactionStatus(transaction.id, 'confirmed', null, 1);
    			} else {
    				updateTransactionStatus(transaction.id, 'failed', result.error);
    			}
    		} catch(error) {
    			updateTransactionStatus(transaction.id, 'failed', error.message);
    		}
    	}

    	function clearCompletedTransactions() {
    		$$invalidate(1, transactions = transactions.filter(tx => tx.status === 'pending'));
    	}

    	function clearAllTransactions() {
    		$$invalidate(1, transactions = []);
    	}

    	// Start monitoring pending transactions
    	onMount(() => {
    		intervalId = setInterval(
    			() => {
    				const pendingTxs = transactions.filter(tx => tx.status === 'pending');

    				pendingTxs.forEach(tx => {
    					if (tx.status === 'pending') {
    						monitorTransaction(tx);
    					}
    				});
    			},
    			3000
    		); // Check every 3 seconds
    	});

    	onDestroy(() => {
    		if (intervalId) {
    			clearInterval(intervalId);
    		}
    	});

    	const writable_props = ['visible', 'transactions'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<TransactionMonitor> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => $$invalidate(0, visible = false);
    	const click_handler_1 = tx => copyToClipboard(tx.digest);
    	const click_handler_2 = tx => openInExplorer(tx.digest);

    	$$self.$$set = $$props => {
    		if ('visible' in $$props) $$invalidate(0, visible = $$props.visible);
    		if ('transactions' in $$props) $$invalidate(1, transactions = $$props.transactions);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		onDestroy,
    		waitForTransactionConfirmation,
    		visible,
    		transactions,
    		intervalId,
    		addTransaction,
    		updateTransactionStatus,
    		monitorTransaction,
    		formatTime,
    		formatTxHash,
    		copyToClipboard,
    		openInExplorer,
    		clearCompletedTransactions,
    		clearAllTransactions
    	});

    	$$self.$inject_state = $$props => {
    		if ('visible' in $$props) $$invalidate(0, visible = $$props.visible);
    		if ('transactions' in $$props) $$invalidate(1, transactions = $$props.transactions);
    		if ('intervalId' in $$props) intervalId = $$props.intervalId;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		visible,
    		transactions,
    		clearCompletedTransactions,
    		clearAllTransactions,
    		addTransaction,
    		click_handler,
    		click_handler_1,
    		click_handler_2
    	];
    }

    class TransactionMonitor extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
    			visible: 0,
    			transactions: 1,
    			addTransaction: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TransactionMonitor",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get visible() {
    		throw new Error("<TransactionMonitor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set visible(value) {
    		throw new Error("<TransactionMonitor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get transactions() {
    		throw new Error("<TransactionMonitor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set transactions(value) {
    		throw new Error("<TransactionMonitor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get addTransaction() {
    		return this.$$.ctx[4];
    	}

    	set addTransaction(value) {
    		throw new Error("<TransactionMonitor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.59.2 */

    const { console: console_1 } = globals;
    const file = "src/App.svelte";

    // (118:46) 
    function create_if_block_1(ctx) {
    	let liquiditycomponent;
    	let current;

    	liquiditycomponent = new LiquidityComponent({
    			props: { wallet: /*wallet*/ ctx[0] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(liquiditycomponent.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(liquiditycomponent, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const liquiditycomponent_changes = {};
    			if (dirty & /*wallet*/ 1) liquiditycomponent_changes.wallet = /*wallet*/ ctx[0];
    			liquiditycomponent.$set(liquiditycomponent_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(liquiditycomponent.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(liquiditycomponent.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(liquiditycomponent, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(118:46) ",
    		ctx
    	});

    	return block;
    }

    // (116:10) {#if activeTab === 'swap'}
    function create_if_block(ctx) {
    	let swapcomponent;
    	let current;

    	swapcomponent = new SwapComponent({
    			props: { wallet: /*wallet*/ ctx[0] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(swapcomponent.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(swapcomponent, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const swapcomponent_changes = {};
    			if (dirty & /*wallet*/ 1) swapcomponent_changes.wallet = /*wallet*/ ctx[0];
    			swapcomponent.$set(swapcomponent_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(swapcomponent.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(swapcomponent.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(swapcomponent, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(116:10) {#if activeTab === 'swap'}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let div4;
    	let div3;
    	let div2;
    	let div0;
    	let h1;
    	let t1;
    	let p0;
    	let t3;
    	let div1;
    	let button0;
    	let t5;
    	let button1;
    	let t6;
    	let t7_value = /*transactions*/ ctx[4].length + "";
    	let t7;
    	let t8;
    	let t9;
    	let div11;
    	let div10;
    	let aside;
    	let walletconnection;
    	let updating_wallet;
    	let t10;
    	let div9;
    	let nav;
    	let button2;
    	let t12;
    	let button3;
    	let t14;
    	let div5;
    	let current_block_type_index;
    	let if_block;
    	let t15;
    	let div8;
    	let div7;
    	let span0;
    	let t17;
    	let span1;
    	let t19;
    	let div6;
    	let t20;
    	let transactionmonitor;
    	let updating_visible;
    	let updating_transactions;
    	let t21;
    	let footer;
    	let div14;
    	let div13;
    	let p1;
    	let t23;
    	let div12;
    	let a0;
    	let t25;
    	let a1;
    	let t27;
    	let a2;
    	let current;
    	let mounted;
    	let dispose;

    	function walletconnection_wallet_binding(value) {
    		/*walletconnection_wallet_binding*/ ctx[9](value);
    	}

    	let walletconnection_props = {};

    	if (/*wallet*/ ctx[0] !== void 0) {
    		walletconnection_props.wallet = /*wallet*/ ctx[0];
    	}

    	walletconnection = new WalletConnection({
    			props: walletconnection_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(walletconnection, 'wallet', walletconnection_wallet_binding));
    	walletconnection.$on("walletConnected", /*handleWalletConnected*/ ctx[5]);
    	walletconnection.$on("walletDisconnected", /*handleWalletDisconnected*/ ctx[6]);
    	const if_block_creators = [create_if_block, create_if_block_1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*activeTab*/ ctx[1] === 'swap') return 0;
    		if (/*activeTab*/ ctx[1] === 'liquidity') return 1;
    		return -1;
    	}

    	if (~(current_block_type_index = select_block_type(ctx))) {
    		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	}

    	function transactionmonitor_visible_binding(value) {
    		/*transactionmonitor_visible_binding*/ ctx[13](value);
    	}

    	function transactionmonitor_transactions_binding(value) {
    		/*transactionmonitor_transactions_binding*/ ctx[14](value);
    	}

    	let transactionmonitor_props = {};

    	if (/*showTransactionMonitor*/ ctx[2] !== void 0) {
    		transactionmonitor_props.visible = /*showTransactionMonitor*/ ctx[2];
    	}

    	if (/*transactions*/ ctx[4] !== void 0) {
    		transactionmonitor_props.transactions = /*transactions*/ ctx[4];
    	}

    	transactionmonitor = new TransactionMonitor({
    			props: transactionmonitor_props,
    			$$inline: true
    		});

    	/*transactionmonitor_binding*/ ctx[12](transactionmonitor);
    	binding_callbacks.push(() => bind(transactionmonitor, 'visible', transactionmonitor_visible_binding));
    	binding_callbacks.push(() => bind(transactionmonitor, 'transactions', transactionmonitor_transactions_binding));

    	const block = {
    		c: function create() {
    			main = element("main");
    			div4 = element("div");
    			div3 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			h1 = element("h1");
    			h1.textContent = "ApexYield";
    			t1 = space();
    			p0 = element("p");
    			p0.textContent = "Advanced DeFi Yield Optimization Platform on Sui";
    			t3 = space();
    			div1 = element("div");
    			button0 = element("button");
    			button0.textContent = "📊 Demo Transaction";
    			t5 = space();
    			button1 = element("button");
    			t6 = text("📊 Transactions (");
    			t7 = text(t7_value);
    			t8 = text(")");
    			t9 = space();
    			div11 = element("div");
    			div10 = element("div");
    			aside = element("aside");
    			create_component(walletconnection.$$.fragment);
    			t10 = space();
    			div9 = element("div");
    			nav = element("nav");
    			button2 = element("button");
    			button2.textContent = "🔄 Swap";
    			t12 = space();
    			button3 = element("button");
    			button3.textContent = "💧 Liquidity";
    			t14 = space();
    			div5 = element("div");
    			if (if_block) if_block.c();
    			t15 = space();
    			div8 = element("div");
    			div7 = element("div");
    			span0 = element("span");
    			span0.textContent = "Network:";
    			t17 = space();
    			span1 = element("span");
    			span1.textContent = "Sui Testnet";
    			t19 = space();
    			div6 = element("div");
    			t20 = space();
    			create_component(transactionmonitor.$$.fragment);
    			t21 = space();
    			footer = element("footer");
    			div14 = element("div");
    			div13 = element("div");
    			p1 = element("p");
    			p1.textContent = "© 2025 ApexYield. Built on Sui Blockchain.";
    			t23 = space();
    			div12 = element("div");
    			a0 = element("a");
    			a0.textContent = "Sui Docs";
    			t25 = space();
    			a1 = element("a");
    			a1.textContent = "GitHub";
    			t27 = space();
    			a2 = element("a");
    			a2.textContent = "Discord";
    			attr_dev(h1, "class", "app-title svelte-18cnxjb");
    			add_location(h1, file, 59, 10, 1816);
    			attr_dev(p0, "class", "app-subtitle svelte-18cnxjb");
    			add_location(p0, file, 60, 10, 1863);
    			attr_dev(div0, "class", "logo-section svelte-18cnxjb");
    			add_location(div0, file, 58, 8, 1779);
    			attr_dev(button0, "class", "demo-btn svelte-18cnxjb");
    			attr_dev(button0, "title", "Add sample transaction (demo)");
    			add_location(button0, file, 64, 10, 2011);
    			attr_dev(button1, "class", "monitor-btn svelte-18cnxjb");
    			attr_dev(button1, "title", "Toggle transaction monitor");
    			add_location(button1, file, 72, 10, 2228);
    			attr_dev(div1, "class", "header-actions svelte-18cnxjb");
    			add_location(div1, file, 63, 8, 1972);
    			attr_dev(div2, "class", "header-content svelte-18cnxjb");
    			add_location(div2, file, 57, 6, 1742);
    			attr_dev(div3, "class", "container");
    			add_location(div3, file, 56, 4, 1712);
    			attr_dev(div4, "class", "app-header svelte-18cnxjb");
    			add_location(div4, file, 55, 2, 1683);
    			attr_dev(aside, "class", "wallet-sidebar svelte-18cnxjb");
    			add_location(aside, file, 87, 6, 2599);
    			attr_dev(button2, "class", "tab-btn svelte-18cnxjb");
    			toggle_class(button2, "active", /*activeTab*/ ctx[1] === 'swap');
    			add_location(button2, file, 98, 10, 2942);
    			attr_dev(button3, "class", "tab-btn svelte-18cnxjb");
    			toggle_class(button3, "active", /*activeTab*/ ctx[1] === 'liquidity');
    			add_location(button3, file, 105, 10, 3137);
    			attr_dev(nav, "class", "tab-navigation svelte-18cnxjb");
    			add_location(nav, file, 97, 8, 2903);
    			attr_dev(div5, "class", "tab-content svelte-18cnxjb");
    			add_location(div5, file, 114, 8, 3361);
    			attr_dev(span0, "class", "status-label svelte-18cnxjb");
    			add_location(span0, file, 125, 12, 3703);
    			attr_dev(span1, "class", "status-value svelte-18cnxjb");
    			add_location(span1, file, 126, 12, 3758);
    			attr_dev(div6, "class", "status-indicator testnet svelte-18cnxjb");
    			add_location(div6, file, 127, 12, 3816);
    			attr_dev(div7, "class", "status-item svelte-18cnxjb");
    			add_location(div7, file, 124, 10, 3665);
    			attr_dev(div8, "class", "network-status svelte-18cnxjb");
    			add_location(div8, file, 123, 8, 3626);
    			attr_dev(div9, "class", "trading-interface svelte-18cnxjb");
    			add_location(div9, file, 96, 6, 2863);
    			attr_dev(div10, "class", "app-layout svelte-18cnxjb");
    			add_location(div10, file, 85, 4, 2527);
    			attr_dev(div11, "class", "container");
    			add_location(div11, file, 84, 2, 2499);
    			add_location(p1, file, 145, 8, 4216);
    			attr_dev(a0, "href", "https://docs.sui.io");
    			attr_dev(a0, "target", "_blank");
    			attr_dev(a0, "rel", "noopener");
    			attr_dev(a0, "class", "svelte-18cnxjb");
    			add_location(a0, file, 147, 10, 4316);
    			attr_dev(a1, "href", "https://github.com");
    			attr_dev(a1, "target", "_blank");
    			attr_dev(a1, "rel", "noopener");
    			attr_dev(a1, "class", "svelte-18cnxjb");
    			add_location(a1, file, 148, 10, 4400);
    			attr_dev(a2, "href", "https://discord.gg");
    			attr_dev(a2, "target", "_blank");
    			attr_dev(a2, "rel", "noopener");
    			attr_dev(a2, "class", "svelte-18cnxjb");
    			add_location(a2, file, 149, 10, 4481);
    			attr_dev(div12, "class", "footer-links svelte-18cnxjb");
    			add_location(div12, file, 146, 8, 4279);
    			attr_dev(div13, "class", "footer-content svelte-18cnxjb");
    			add_location(div13, file, 144, 6, 4179);
    			attr_dev(div14, "class", "container");
    			add_location(div14, file, 143, 4, 4149);
    			attr_dev(footer, "class", "app-footer svelte-18cnxjb");
    			add_location(footer, file, 142, 2, 4117);
    			attr_dev(main, "class", "svelte-18cnxjb");
    			add_location(main, file, 54, 0, 1674);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div4);
    			append_dev(div4, div3);
    			append_dev(div3, div2);
    			append_dev(div2, div0);
    			append_dev(div0, h1);
    			append_dev(div0, t1);
    			append_dev(div0, p0);
    			append_dev(div2, t3);
    			append_dev(div2, div1);
    			append_dev(div1, button0);
    			append_dev(div1, t5);
    			append_dev(div1, button1);
    			append_dev(button1, t6);
    			append_dev(button1, t7);
    			append_dev(button1, t8);
    			append_dev(main, t9);
    			append_dev(main, div11);
    			append_dev(div11, div10);
    			append_dev(div10, aside);
    			mount_component(walletconnection, aside, null);
    			append_dev(div10, t10);
    			append_dev(div10, div9);
    			append_dev(div9, nav);
    			append_dev(nav, button2);
    			append_dev(nav, t12);
    			append_dev(nav, button3);
    			append_dev(div9, t14);
    			append_dev(div9, div5);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].m(div5, null);
    			}

    			append_dev(div9, t15);
    			append_dev(div9, div8);
    			append_dev(div8, div7);
    			append_dev(div7, span0);
    			append_dev(div7, t17);
    			append_dev(div7, span1);
    			append_dev(div7, t19);
    			append_dev(div7, div6);
    			append_dev(main, t20);
    			mount_component(transactionmonitor, main, null);
    			append_dev(main, t21);
    			append_dev(main, footer);
    			append_dev(footer, div14);
    			append_dev(div14, div13);
    			append_dev(div13, p1);
    			append_dev(div13, t23);
    			append_dev(div13, div12);
    			append_dev(div12, a0);
    			append_dev(div12, t25);
    			append_dev(div12, a1);
    			append_dev(div12, t27);
    			append_dev(div12, a2);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*addSampleTransaction*/ ctx[8], false, false, false, false),
    					listen_dev(button1, "click", /*toggleTransactionMonitor*/ ctx[7], false, false, false, false),
    					listen_dev(button2, "click", /*click_handler*/ ctx[10], false, false, false, false),
    					listen_dev(button3, "click", /*click_handler_1*/ ctx[11], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if ((!current || dirty & /*transactions*/ 16) && t7_value !== (t7_value = /*transactions*/ ctx[4].length + "")) set_data_dev(t7, t7_value);
    			const walletconnection_changes = {};

    			if (!updating_wallet && dirty & /*wallet*/ 1) {
    				updating_wallet = true;
    				walletconnection_changes.wallet = /*wallet*/ ctx[0];
    				add_flush_callback(() => updating_wallet = false);
    			}

    			walletconnection.$set(walletconnection_changes);

    			if (!current || dirty & /*activeTab*/ 2) {
    				toggle_class(button2, "active", /*activeTab*/ ctx[1] === 'swap');
    			}

    			if (!current || dirty & /*activeTab*/ 2) {
    				toggle_class(button3, "active", /*activeTab*/ ctx[1] === 'liquidity');
    			}

    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if (~current_block_type_index) {
    					if_blocks[current_block_type_index].p(ctx, dirty);
    				}
    			} else {
    				if (if_block) {
    					group_outros();

    					transition_out(if_blocks[previous_block_index], 1, 1, () => {
    						if_blocks[previous_block_index] = null;
    					});

    					check_outros();
    				}

    				if (~current_block_type_index) {
    					if_block = if_blocks[current_block_type_index];

    					if (!if_block) {
    						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    						if_block.c();
    					} else {
    						if_block.p(ctx, dirty);
    					}

    					transition_in(if_block, 1);
    					if_block.m(div5, null);
    				} else {
    					if_block = null;
    				}
    			}

    			const transactionmonitor_changes = {};

    			if (!updating_visible && dirty & /*showTransactionMonitor*/ 4) {
    				updating_visible = true;
    				transactionmonitor_changes.visible = /*showTransactionMonitor*/ ctx[2];
    				add_flush_callback(() => updating_visible = false);
    			}

    			if (!updating_transactions && dirty & /*transactions*/ 16) {
    				updating_transactions = true;
    				transactionmonitor_changes.transactions = /*transactions*/ ctx[4];
    				add_flush_callback(() => updating_transactions = false);
    			}

    			transactionmonitor.$set(transactionmonitor_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(walletconnection.$$.fragment, local);
    			transition_in(if_block);
    			transition_in(transactionmonitor.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(walletconnection.$$.fragment, local);
    			transition_out(if_block);
    			transition_out(transactionmonitor.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(walletconnection);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].d();
    			}

    			/*transactionmonitor_binding*/ ctx[12](null);
    			destroy_component(transactionmonitor);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let wallet = null;
    	let activeTab = 'swap';
    	let showTransactionMonitor = false;
    	let transactionMonitorRef;
    	let transactions = [];

    	function handleWalletConnected(event) {
    		$$invalidate(0, wallet = event.detail);
    		console.log('Wallet connected:', wallet);
    	}

    	function handleWalletDisconnected() {
    		$$invalidate(0, wallet = null);
    		console.log('Wallet disconnected');
    	}

    	function toggleTransactionMonitor() {
    		$$invalidate(2, showTransactionMonitor = !showTransactionMonitor);
    	}

    	function addTransaction(digest, description) {
    		if (transactionMonitorRef) {
    			return transactionMonitorRef.addTransaction(digest, description);
    		}
    	}

    	// Demo function to add sample transactions (for testing)
    	function addSampleTransaction() {
    		const sampleDigests = [
    			'0x1234567890abcdef1234567890abcdef12345678',
    			'0xabcdef1234567890abcdef1234567890abcdef12',
    			'0x567890abcdef1234567890abcdef1234567890ab'
    		];

    		const randomDigest = sampleDigests[Math.floor(Math.random() * sampleDigests.length)];

    		const descriptions = [
    			'Token Swap: SUI → USDC',
    			'Add Liquidity: SUI/USDC Pool',
    			'Remove Liquidity: USDC/USDT Pool',
    			'Multi-hop Swap: SUI → USDT'
    		];

    		const randomDesc = descriptions[Math.floor(Math.random() * descriptions.length)];
    		addTransaction(randomDigest, randomDesc);
    		$$invalidate(2, showTransactionMonitor = true);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function walletconnection_wallet_binding(value) {
    		wallet = value;
    		$$invalidate(0, wallet);
    	}

    	const click_handler = () => $$invalidate(1, activeTab = 'swap');
    	const click_handler_1 = () => $$invalidate(1, activeTab = 'liquidity');

    	function transactionmonitor_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			transactionMonitorRef = $$value;
    			$$invalidate(3, transactionMonitorRef);
    		});
    	}

    	function transactionmonitor_visible_binding(value) {
    		showTransactionMonitor = value;
    		$$invalidate(2, showTransactionMonitor);
    	}

    	function transactionmonitor_transactions_binding(value) {
    		transactions = value;
    		$$invalidate(4, transactions);
    	}

    	$$self.$capture_state = () => ({
    		WalletConnection,
    		SwapComponent,
    		LiquidityComponent,
    		TransactionMonitor,
    		wallet,
    		activeTab,
    		showTransactionMonitor,
    		transactionMonitorRef,
    		transactions,
    		handleWalletConnected,
    		handleWalletDisconnected,
    		toggleTransactionMonitor,
    		addTransaction,
    		addSampleTransaction
    	});

    	$$self.$inject_state = $$props => {
    		if ('wallet' in $$props) $$invalidate(0, wallet = $$props.wallet);
    		if ('activeTab' in $$props) $$invalidate(1, activeTab = $$props.activeTab);
    		if ('showTransactionMonitor' in $$props) $$invalidate(2, showTransactionMonitor = $$props.showTransactionMonitor);
    		if ('transactionMonitorRef' in $$props) $$invalidate(3, transactionMonitorRef = $$props.transactionMonitorRef);
    		if ('transactions' in $$props) $$invalidate(4, transactions = $$props.transactions);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		wallet,
    		activeTab,
    		showTransactionMonitor,
    		transactionMonitorRef,
    		transactions,
    		handleWalletConnected,
    		handleWalletDisconnected,
    		toggleTransactionMonitor,
    		addSampleTransaction,
    		walletconnection_wallet_binding,
    		click_handler,
    		click_handler_1,
    		transactionmonitor_binding,
    		transactionmonitor_visible_binding,
    		transactionmonitor_transactions_binding
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'ApexYield'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
