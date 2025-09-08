import { TestBed } from '@angular/core/testing';

import { Phantom } from './phantom';

describe('Phantom', () => {
  let service: Phantom;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Phantom);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
