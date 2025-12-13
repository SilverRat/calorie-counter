import nextConfig from 'eslint-config-next';

const config = [
  {
    ignores: ['.next/**', 'node_modules/**'],
  },
  // nextConfig already exports an array for flat config; spread it directly
  ...nextConfig,
];

export default config;
