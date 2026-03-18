/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { safeStringify, prettyStringify } from '../../src/utils/safeStringify';

describe('safeStringify', () => {
  it('handles circular references without throwing', () => {
    const obj: any = { a: 1 };
    obj.self = obj;
    // Should not throw — circular ref is omitted
    expect(() => safeStringify(obj)).not.toThrow();
    const result = JSON.parse(safeStringify(obj));
    expect(result.a).toBe(1);
  });

  it('handles repeated (non-circular) references by deep copying', () => {
    const shared = { x: 42 };
    const obj = { a: shared, b: shared };
    const result = JSON.parse(safeStringify(obj));
    expect(result.a.x).toBe(42);
    expect(result.b.x).toBe(42);
  });

  it('handles arrays', () => {
    expect(safeStringify({ arr: [1, 2, 3] } as any)).toBe('{"arr":[1,2,3]}');
  });

  it('handles null values', () => {
    expect(safeStringify({ a: null } as any)).toBe('{"a":null}');
  });
});

describe('prettyStringify', () => {
  it('formats with 2-space indent', () => {
    const result = prettyStringify({ a: 1 });
    expect(result).toContain('  "a": 1');
  });

  it('collapses small numeric arrays onto one line', () => {
    const result = prettyStringify({ color: [255, 0, 128, 200] });
    expect(result).toContain('[255, 0, 128, 200]');
    // Should NOT have newlines inside the array
    expect(result).not.toMatch(/\[\s*\n\s*255/);
  });

  it('collapses arrays with strings onto one line', () => {
    const result = prettyStringify({ tags: ['a', 'b'] });
    expect(result).toContain('["a", "b"]');
  });

  it('collapses arrays with booleans and null', () => {
    const result = prettyStringify({ flags: [true, false, null] });
    expect(result).toContain('[true, false, null]');
  });

  it('does not collapse arrays containing objects', () => {
    const result = prettyStringify({ items: [{ a: 1 }, { b: 2 }] });
    // Objects inside arrays should still be multi-line
    expect(result).toContain('\n');
  });
});
