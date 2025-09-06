import { TestBed } from '@angular/core/testing';

import { Idl } from './idl';

describe('Idl', () => {
  let service: Idl;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Idl);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
