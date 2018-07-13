// An older version of the HTML Standard mandated that document.open() remove
// all tasks associated with the document on which open() is called. This step
// has been proposed to be removed. This series of tests ensures that this step
// is no longer executed.
//
// This file comprehensively (but not exhaustively) tests for many queued tasks
// that may be observable. Each taskTest() call in fact runs two tests: the
// first one "tasks without document.open()" does not actually run
// document.open(), just to test that the tested task works ordinarily; the
// second actually calls document.open() to test if the method call removes
// that specific task from the queue.

let i = 0;
function taskTest(description, testBody) {
  async_test(t => {
    const frame = document.body.appendChild(document.createElement("iframe"));
    // The empty HTML seems to be necessary to cajole Chrome into firing a load
    // event, which is necessary to make sure the frame's document doesn't have
    // a parser associated with it.
    frame.src = `resources/empty.html?${i++}`;
    t.add_cleanup(() => frame.remove());
    frame.onload = t.step_func(() => {
      // Make sure there is no parser. Firefox seems to have an additional
      // non-spec-compliant readiness state "uninitialized", so test for the
      // two known valid readiness states instead.
      assert_in_array(frame.contentDocument.readyState, ["interactive", "complete"]);
      testBody(t, frame, doc => {});
    });
  }, `tasks without document.open() (${description})`);

  async_test(t => {
    const frame = document.body.appendChild(document.createElement("iframe"));
    // The empty HTML seems to be necessary to cajole Chrome into firing a load
    // event, which is necessary to make sure the frame's document doesn't have
    // a parser associated with it.
    frame.src = `resources/empty.html?${i++}`;
    t.add_cleanup(() => frame.remove());
    frame.onload = t.step_func(() => {
      // Make sure there is no parser. Firefox seems to have an additional
      // non-spec-compliant readiness state "uninitialized", so test for the
      // two known valid readiness states instead.
      assert_in_array(frame.contentDocument.readyState, ["interactive", "complete"]);
      testBody(t, frame, doc => doc.open());
    });
  }, `document.open() and tasks (${description})`);
}

taskTest("timeout", (t, frame, open) => {
  let happened = false;
  frame.contentWindow.setTimeout(() => happened = true, 100);
  open(frame.contentDocument);
  t.step_timeout(() => {
    assert_true(happened);
    t.done();
  }, 200);
});

taskTest("window message", (t, frame, open) => {
  let counter = 0;
  frame.contentWindow.postMessage(undefined, "*");
  open(frame.contentDocument);
  frame.contentWindow.postMessage(undefined, "*");
  frame.contentWindow.onmessage = t.step_func(e => {
    assert_equals(e.data, undefined);
    counter++;
    assert_less_than_equal(counter, 2);
    if (counter == 2) {
      t.done();
    }
  });
});

taskTest("canvas.toBlob()", (t, frame, open) => {
  const canvas = frame.contentDocument.body.appendChild(frame.contentDocument.createElement("canvas"));
  canvas.toBlob(t.step_func_done());
  open(frame.contentDocument);
});

// const STORAGE_KEY_PREFIX = "document-open-task-test-";
// let storageKeyIdx = 0;
// taskTest("sessionStorage and storage event", (t, frame, open) => {
//   const STORAGE_KEY = `${STORAGE_KEY_PREFIX}${storageKeyIdx++}`;
//   const eventListener = t.step_func(ev => {
//     console.log(STORAGE_KEY, ev);
//     // Ignore events that don't relate to the key we are testing right now.
//     if (ev.key !== STORAGE_KEY) {
//       return;
//     }
//     assert_equals(ev.newValue, "1");
//     t.done();
//   });
//   t.add_cleanup(() => {
//     sessionStorage.removeItem(STORAGE_KEY);
//   });
//   // Needed to ensure event fires, since the storage event is only fired when
//   // the storage area *changes*.
//   // Does not use the current window's sessionStorage to avoid the event firing
//   // twice.
//   frame.contentWindow.sessionStorage.removeItem(STORAGE_KEY);
//   sessionStorage.setItem(STORAGE_KEY, "1");
//   open(frame.contentDocument);
//   frame.contentWindow.addEventListener("storage", eventListener);
// });

taskTest("MessagePort", (t, frame, open) => {
  frame.contentWindow.eval(`({ port1, port2 } = new MessageChannel());`);
  frame.contentWindow.port2.onmessage = t.step_func_done(ev => {
    assert_equals(ev.data, "Hello world");
  });
  frame.contentWindow.port1.postMessage("Hello world");
  open(frame.contentDocument);
});

taskTest("Promise rejection", (t, frame, open) => {
  const promise = frame.contentWindow.eval("Promise.reject(42);");
  open(frame.contentDocument);
  frame.contentWindow.onunhandledrejection = t.step_func_done(ev => {
    assert_equals(ev.promise, promise);
    assert_equals(ev.reason, 42);
  });
});

taskTest("marquee start", (t, frame, open) => {
  const doc = frame.contentDocument;
  const marquee = doc.body.appendChild(doc.createElement("marquee"));
  open(frame.contentDocument);
  marquee.addEventListener("start", t.step_func_done());
});
