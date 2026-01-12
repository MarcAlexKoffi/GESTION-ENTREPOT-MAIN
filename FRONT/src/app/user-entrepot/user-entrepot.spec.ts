import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserEntrepot } from './user-entrepot';

describe('UserEntrepot', () => {
  let component: UserEntrepot;
  let fixture: ComponentFixture<UserEntrepot>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserEntrepot]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserEntrepot);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
