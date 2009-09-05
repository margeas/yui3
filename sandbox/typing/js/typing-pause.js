/**
 * Custom event that fires after a configured delay in keyboard activity.  The
 * optional configuration object passed as the fourth param to Y.on accepts the
 * following keys:
 * <ul>
 *  <li><code>adaptive</code> - adapt the delay to the user's typing rate.
 *  Default <code>true</code></li>
 *  <li><code>minLength</code> - minimum number of characters to qualify
 *  firing.  Default 1.</li>
 *  <li><code>minWait</code> - minimum millisecond delay before firing.
 *  Default 400.</li>
 *  <li><code>maxWait</code> - maximum millisecond delay before firing.
 *  Default 3000.</li>
 *  <li><code>waitMultiplier</code> - multiplier applied to the user's average
 *  keyup rate.  Used to calculate the firing delay.  Default 4.</li>
 *  <li><code>filter</code> - function that can be used to translate input
 *  value into something more appropriate for evaluation against minLength.
 *  Default <code>null</code></li>
 * </ul>
 *
 * When in adaptive mode, an appropriate delay based on the user's typing speed
 * will be calculated will be used for event firing.  The calculated delay will
 * be constrained between minWait and maxWait.  In non-adaptive mode, no
 * calculations are done.  A delay of minWait will trigger the event.
 *
 * @event typing-pause
 * @for YUI
 * @param type {String} 'typing'
 * @param fn {Function} the callback function
 * @param el {String|Node|etc} the element(s) to bind
 * @param conf {Object} configuration for delay, minimum characters, etc
 * @param o {Object} optional context object
 * @param args 0..n additional arguments that should be provided 
 * to the listener.
 * @return {Event.Handle} the detach handle
 */
var eventName = 'typing-pause',
    event = {

        on: function(type, fn, el, conf, o) {

            conf = conf || {};

            var args = Y.Array(arguments,0,true),
                target      = Y.all(el),
                adaptive    = 'adaptive' in conf ? conf.adaptive : true,
                minLength   = conf.minLength      || 1,
                minWait     = conf.minWait        || 400,
                maxWait     = conf.maxWait        || 3000,
                multiplier  = conf.waitMultiplier || 4,
                filter      = Y.Lang.isFunction(conf.filter) ? conf.filter : null,
                round       = Math.round,
                strokes     = 0,
                first       = 0,
                _proxyEvent,
                handles,
                timer;

            // If a selector string that doesn't match any elements, auto poll
            // for available.
            if (Y.Lang.isString(el) && target.size() === 0) {
                // @FIXME: onAvailable will return only the first found, so
                // non-id selectors will behave differently.
                // @FIME: the return value from onAvailable is not a detach
                // handler for *this* event
                return Y.Event.onAvailable(el, function () {
                    Y.on.apply(Y,args);
                }, Y.Event, true, false);
            }

            if (target.size() > 1) {
                handles = [];
                target.each(function (t) {
                    args[2] = t;
                    handles.push(Y.on.apply(Y,args));
                });
                return handles;
            }
            
            // At this point, the target should be a NodeList with 0 or one Node
            // instances.
            if (target.size() === 1) {
                target = target.item(0);

                // Create a unique custom event proxy name for this subscription
                _proxyEvent = Y.stamp(target) + '-' + eventName;

                // @TODO: capture these handles for detach
                if (!target.getEvent(_proxyEvent)) {
                    target.on('keyup', handler);
                    if (adaptive) {
                        target.on('blur', reset);
                    }
                }

                args.splice(2,1);
                args[0] = _proxyEvent;

                return target.on.apply(target,args);
            } else {
                return null;
            }


            // Support functions
            function handler(e) {
                // Allow delete and backspace, but not shift, alt, ctrl, etc
                if (e.keyCode < 46 && e.keyCode !== 8 && e.keyCode !== 32) {
                    return;
                }

                var node  = this,
                    raw   = this.get('value'),
                    value = filter ? filter(raw) : raw,
                    delay, now;

                if (timer) {
                    timer.cancel();
                    timer = null;
                }

                if (value && value.length > minLength) {
                    if (adaptive) {
                        now = new Date().getTime();

                        ++strokes;

                        // On first key stroke, use the maxWait amount because we
                        // don't have enough data to calculate a reasonable delay
                        if (strokes === 1) {
                            first = now;
                            delay = maxWait;
                        } else {
                            delay = round((now - first) / strokes) * multiplier;
                            if (delay > maxWait) {
                                delay = maxWait;
                            }
                        }

                        if (delay < minWait) {
                            delay = minWait;
                        }
                    } else {
                        delay = minWait;
                    }

                    timer = Y.later(minWait, null, function () {
                        // TODO: deal with subscription extra args
                        // TODO: assumes Node extends Base?
                        node.fire(_proxyEvent, {
                            type: eventName,
                            inputValue: raw,
                            value: value,
                            lastKeyEvent: e,
                            target: target,
                            currentTarget: target
                        });
                    });
                }
            }

            function reset() {
                strokes = 0;

                if (timer) {
                    timer.cancel();
                    timer = null;
                }
            }

        }

        // @TODO: I need a detach section
    };

Y.Env.evt.plugins[eventName] = event;
if (Y.Node) {
    Y.Node.DOM_EVENTS[eventName] = event;
}
