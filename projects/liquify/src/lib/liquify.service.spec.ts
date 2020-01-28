import { TestBed } from '@angular/core/testing';

import { LiquifyService } from './liquify.service';

describe('LiquifyService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: LiquifyService = TestBed.get(LiquifyService);
    expect(service).toBeTruthy();
  });
});
