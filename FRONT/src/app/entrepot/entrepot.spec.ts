import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Entrepot } from './entrepot';

describe('Entrepot', () => {
  let component: Entrepot;
  let fixture: ComponentFixture<Entrepot>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Entrepot]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Entrepot);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
