import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    'no-console': 'off',
    'ts/no-unsafe-function-type': 'off',
  }
})
