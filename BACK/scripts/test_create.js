const axios = require('axios');
const FormData = require('form-data');

async function testCreate() {
  const form = new FormData();
  form.append('name', 'Test Warehouse');
  form.append('location', 'Test Location');
  
  try {
    const response = await axios.post('http://localhost:3000/api/warehouses', form, {
      headers: form.getHeaders()
    });
    console.log('SUCCESS:', response.data);
  } catch (error) {
    if (error.response) {
      console.log('ERROR STATUS:', error.response.status);
      console.log('ERROR DATA:', error.response.data);
    } else {
      console.log('ERROR MESSAGE:', error.message);
    }
  }
}

testCreate();
