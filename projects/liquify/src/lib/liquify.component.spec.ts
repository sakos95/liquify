import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { LiquifyComponent } from './liquify.component';
import { HttpClientModule } from '@angular/common/http';
import { SimpleChange } from '@angular/core';
import {DefaultFunctionSources} from './defaults/function.sources.default';

describe('LiquifyComponent', () => {
  let component: LiquifyComponent;
  let fixture: ComponentFixture<LiquifyComponent>;

  const fakeURL = 'ws://localhost:9875/';

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ LiquifyComponent ],
      imports: [HttpClientModule]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(LiquifyComponent);
    component = fixture.componentInstance;
    console.log('component created');

    component.functionSource = new DefaultFunctionSources();
    component.dataSetIDs = ['0'];
    component.addresses = [fakeURL];
    component.colors = new Map<string, number[]>();
    component.colors.set(component.dataSetIDs[0], [0, 0, 128]);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('latency should\'t be 60', ((done) => {
    setTimeout(() => {
      component.colors.set(component.dataSetIDs[0], [0, 128, 0]);
      component.ngOnChanges({
        colors: new SimpleChange(null, component.colors, false)
      });
      fixture.detectChanges();
    }, 2000);
    setTimeout(() => {
      fixture.detectChanges();
      expect(component.latency !== 60).toBeTruthy();
      done();
    }, 2000);
  }));

  it('canvas should change size', ((done) => {
    component.width = 1000;
    component.height = 500;
    component.ngOnChanges({
      width: new SimpleChange(null, component.width, false)
    });
    component.ngOnChanges({
      height: new SimpleChange(null, component.height, false)
    });
    setTimeout(() => {
      fixture.detectChanges();
      expect(component.canvasRef.nativeElement.width === 1000 && component.canvasRef.nativeElement.height === 500).toBeTruthy();
      done();
    }, 2000);
  }));
});
