import { BoxGeometry, Mesh, MeshStandardMaterial } from '@iwsdk/core';

/** Day 1 smoke-test cube: 6 cm, warm clay colour, origin at its centre. */
export function createTestCube(): Mesh {
  const mesh = new Mesh(
    new BoxGeometry(0.06, 0.06, 0.06),
    new MeshStandardMaterial({ color: 0xd9824a, roughness: 0.7 }),
  );
  mesh.name = 'TestCube';
  return mesh;
}
