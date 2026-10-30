const fs = require('fs');
const path = require('path');

function patchFs(fsModule) {
  if (!fsModule) return;

  const origReadlinkSync = fsModule.readlinkSync;
  if (origReadlinkSync) {
    fsModule.readlinkSync = function (p, options) {
      try {
        return origReadlinkSync(p, options);
      } catch (err) {
        if (err && err.code === 'EISDIR') {
          const e = new Error(`EINVAL: invalid argument, readlink '${p}'`);
          e.code = 'EINVAL';
          throw e;
        }
        throw err;
      }
    };
  }

  const origReadlink = fsModule.readlink;
  if (origReadlink) {
    fsModule.readlink = function (p, options, callback) {
      const cb = typeof options === 'function' ? options : callback;
      const opts = typeof options === 'function' ? undefined : options;
      return origReadlink(p, opts, (err, linkString) => {
        if (err && err.code === 'EISDIR') {
          const e = new Error(`EINVAL: invalid argument, readlink '${p}'`);
          e.code = 'EINVAL';
          return cb(e);
        }
        return cb(err, linkString);
      });
    };
  }

  if (fsModule.promises) {
    const origPromisesReadlink = fsModule.promises.readlink;
    if (origPromisesReadlink) {
      fsModule.promises.readlink = async function (p, options) {
        try {
          return await origPromisesReadlink(p, options);
        } catch (err) {
          if (err && err.code === 'EISDIR') {
            const e = new Error(`EINVAL: invalid argument, readlink '${p}'`);
            e.code = 'EINVAL';
            throw e;
          }
          throw err;
        }
      };
    }
  }
}

patchFs(fs);

try {
  const workerThreads = require('worker_threads');
  if (workerThreads.Worker) {
    const OrigWorker = workerThreads.Worker;
    workerThreads.Worker = class PatchedWorker extends OrigWorker {
      constructor(filename, options = {}) {
        const currentExecArgv = options.execArgv || process.execArgv || [];
        const hasPatch = currentExecArgv.some((a) => typeof a === 'string' && a.includes('patch-node.js'));
        if (!hasPatch) {
          options.execArgv = [...currentExecArgv, '-r', __filename];
        }
        super(filename, options);
      }
    };
  }
} catch {}
