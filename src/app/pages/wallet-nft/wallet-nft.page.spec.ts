import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WalletNftPage } from './wallet-nft.page';

describe('WalletNftPage', () => {
  let component: WalletNftPage;
  let fixture: ComponentFixture<WalletNftPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(WalletNftPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
