const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const originalResolveFilename = Module._resolveFilename;
const nextServerMarker = `${path.sep}.next${path.sep}server${path.sep}`;
const chunkRequestPattern = /^\.{1,2}[\\/]\d+\.js$/;

Module._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
    if (typeof request === 'string' && chunkRequestPattern.test(request) && parent?.filename) {
        const parentFile = path.normalize(parent.filename);
        const directCandidate = path.resolve(path.dirname(parentFile), request);

        if (!fs.existsSync(directCandidate)) {
            const markerIndex = parentFile.indexOf(nextServerMarker);
            if (markerIndex !== -1) {
                const serverRoot = parentFile.slice(0, markerIndex + nextServerMarker.length - 1);
                const chunkCandidate = path.join(serverRoot, 'chunks', path.basename(request));

                if (fs.existsSync(chunkCandidate)) {
                    return originalResolveFilename.call(this, chunkCandidate, parent, isMain, options);
                }
            }
        }
    }

    return originalResolveFilename.call(this, request, parent, isMain, options);
};
