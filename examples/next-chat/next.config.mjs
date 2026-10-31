// React hooks must use Next's bundled React instance during server rendering.
// Only the Node server engine is loaded as an external package.
export default {serverExternalPackages:['@intlui/server']};
