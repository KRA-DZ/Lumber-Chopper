// World Y now spans -3200…6400. Ground must remain below northern actors;
// screen/weather/interaction layers must stay above the southernmost sprites.
export const LAYERS = Object.freeze({
  ground: -4500,
  border: 10000,
  labels: 10500,
  smoke: 10999,
  particles: 11000,
  glow: 11001,
  air: 11002,
  hints: 11003,
  health: 11004,
  healthText: 11005,
  flights: 11050,
  floating: 11100,
  tint: 11500,
  night: 12000,
  eyes: 12500,
});
