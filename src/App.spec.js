import { mount } from '@vue/test-utils';
import App from './App';

describe('App', () => {
  test('should be accessible as a Vue instance', () => {
    const wrapper = mount(App);
    expect(wrapper.isVueInstance()).toBeTruthy();
  });
});
