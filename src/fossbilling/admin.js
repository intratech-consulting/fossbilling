const axios = require("axios");
const BoxBillingService = require("./bbService");
const Encryption = require("./encryption");
const { response } = require("express");
require("dotenv").config();

class admin {
    constructor() {
        this.bbService = new BoxBillingService({
            api_role: 'admin',
            api_token: process.env.API_KEY,
            api_url: process.env.API_URL,
        });
        this.enc = new Encryption();
    }

    async createClient(userData) {
        // Check if required parameters are provided
        if (!userData.email || !userData.first_name) {
            throw new Error('email and first_name are required');
        }
        console.log(userData.telephone);

        const address = userData.address || {};
        const password = "test@mail.com";

        const clientData = {
            email: userData.email || "test@mail.com",
            first_name: userData.first_name || "Test",
            last_name: userData.last_name || "",
            status: "active",
            company: userData.company_id || "",
            address_1: `${address.street} ${address.house_number}` || "",
            address_2: "",
            city: address.city || "",
            state: address.state || "",
            country: address.country || "",
            postcode: address.zip || "",
            phone_cc: userData.telephone.toString().substring(0, 3) || "",
            phone: userData.telephone.toString().substring(3) || "",
            currency: "",
            password: `${await this.enc.encryptString(password)}Pass1234`
        };

        console.log(clientData)

        try {
            const response = await this.bbService.callMethod('client_create', [clientData]);
            return response;
        } catch (error) {
            console.error(`Error creating client: ${error}`);
            throw error;
        }
    };

    async deleteClient(clientId) {
        console.log("clientId:", clientId)
        if (!await this.checkClientInvoice(clientId)) {
            try {
                console.log("client_delete")
                const response = await this.bbService.callMethod('client_delete', [{ id: clientId }]);
                return response;
            } catch (error) {
                console.error(`Error deleting client: ${error}`);
                throw error;
            }
        } else {
            throw new Error('Client has invoices, can\'t be deleted.');
        }
    }

    async updateClient(updateData, clientId = updateData.id) {
        // Check if required parameters are provided
        if (!clientId) {
            throw new Error('client_id is required');
        }

        const {
            email,
            first_name,
            last_name,
            company_id,
            telephone,
            address: {
                street,
                house_number,
                city,
                state,
                country,
                zip
            } = {}
        } = updateData;

        const clientData = {
            id: clientId,
            ...(email && email[0] && { email: email }),
            ...(first_name && first_name[0] && { first_name: first_name }),
            ...(last_name && last_name[0] && { last_name: last_name }),
            ...(company_id && company_id[0] && { company: company_id }),
            ...(telephone && telephone[0] && {
                phone_cc: telephone.toString().substring(0, 3),
                phone: telephone.toString().substring(3)
            }),
            ...(street && house_number && street[0] && house_number[0] && { address_1: `${street} ${house_number}` }),
            ...(city && city[0] && { city: city }),
            ...(state && state[0] && { state: state }),
            ...(country && country[0] && { country: country }),
            ...(zip && zip[0] && { postcode: zip })
        };

        try {
            const response = await this.bbService.callMethod('client_update', [clientData]);
            return response;
        } catch (error) {
            console.error(`Error updating client: ${error}`);
            throw error;
        }
    };

    async createOrder(orderData, clientID = orderData.id) {

        // Check if required parameters are provided
        if (!orderData.id || !orderData.products.product.product_id) {
            throw new Error('client_id and product_id are required');
        }

        // Prepare the data for the API call
        const data = {
            client_id: clientID,
            product_id: orderData.products.product.product_id,
            config: orderData.config || {},
            quantity: orderData.products.product.amount || 1,
            price: orderData.total_price,
            company: orderData.company_id || "",
            currency: "",
            title: orderData.products.product.name || "Cola",
            status: "active",
            invoice_option: "issue-invoice",
            created_at: orderData.created_at,
            updated_at: orderData.updated_at
        };

        try {
            const response = await this.bbService.callMethod('order_create', [data]);
            return response;
        } catch (error) {
            console.error(`Error creating order: ${error}`);
            throw error;
        }
    }

    async deleteOrder(orderId) {
        try {
            const response = await this.bbService.callMethod('order_delete', [{ id: orderId }]);
            return response;
        } catch (error) {
            console.error(`Error deleting order: ${error}`);
            throw error;
        }
    }

    async getClient(email, clientId = '') {
        try {
            console.log("email:", email, "| clientId:", clientId);
            const response = await this.bbService.callMethod('client_get', [{ id: clientId, email: email }]);
            return response;
        } catch (error) {
            console.error(`Error getting client: ${error}`);
            throw error;
        }
    }

    async getClientList() {
        try {
            const response = await this.bbService.callMethod('client_get_list', []);
            return response;
        } catch (error) {
            console.error(`Error getting client list: ${error}`);
            throw error;
        }
    }

    async getCartList() {
        try {
            const response = await this.bbService.callMethod('cart_get_list', []);
            return response;
        } catch (error) {
            console.error(`Error getting cart: ${error}`);
            throw error;
        }
    }

    async batchExpire() {
        try {
            const response = await this.bbService.callMethod('cart_batch_expire', []);
            return response;
        } catch (error) {
            console.error(`Error expiring batch: ${error}`);
            throw error;
        }
    }

    async userExists(email, id='') {
        try {
            await this.getClient(email, id);
            return true;
        } catch (error) {
            return false;
        }
    }

    async viewInvoice(invoiceHash) {
        try {
            let url = new URL(process.env.API_URL);
            let pathname = url.pathname;
            if (pathname.endsWith('/api')) {
                pathname = pathname.substring(0, pathname.length - 4);
            }
            url.pathname = pathname;
            const response = await axios.get(`${url.toString()}invoice/pdf/${invoiceHash}`, { responseType: 'arraybuffer' });
            let base64Response = Buffer.from(response.data, 'binary').toString('base64');
            return base64Response;
        } catch (error) {
            console.error(`Error viewing invoice: ${error}`);
            throw error;
        }
    }

    async getInvoice(invoiceId) {

        let invoicePdfBase64 = '';

        try {
            const response = await this.bbService.callMethod('invoice_get', [{ id: invoiceId }]);
            if (response && response.hash) {
                invoicePdfBase64 = await this.viewInvoice(response.hash);
            }
            return invoicePdfBase64;
        } catch (error) {
            console.error(`Error getting invoice: ${error}`);
            throw error;
        }
    }

    async getInvoiceList(page = 1, per_page = 100) {
        try {
            const response = await this.bbService.callMethod('invoice_get_list', [{ page, per_page }]);
            return response;
        } catch (error) {
            console.error(`Error getting invoice list: ${error}`);
            throw error;
        }
    }

    // Check if client has invoices. Will return true if an invoice is found
    async checkClientInvoice(clientId) {
        let page = 1;
        while (true) {
            const response = await this.getInvoiceList(page);
            if (response && response.list) {
                for (let invoice of response.list) {
                    if (invoice.client_id === clientId) {
                        if (invoice.status !== 'paid') {
                            console.log(`Client has invoice: ${invoice.id}`)
                            return true;
                        }
                    }
                }
            }
            if (page >= response.pages) {
                break;
            }
            page++;
        }
        console.log('no invoices found')
        return false;
    }

    async getOrder(orderId) {
        try {
            const response = await this.bbService.callMethod('order_get', [{ id: orderId }]);
            return response;
        } catch (error) {
            console.error(`Error getting order: ${error}`);
            throw error;
        }
    }

    async updateInvoice(invoiceId, status) {

        let data = {};

        if (status === 'paid') {
            data = {
                gateway_id: 1,
                id: invoiceId,
                status: "paid",
            };
        } else {
            data = {
                gateway_id: 1,
                id: invoiceId,
            };
        }

        try {
            const response = await this.bbService.callMethod('invoice_update', [data]);
            return response;
        } catch (error) {
            console.error(`Error updating invoice: ${error}`);
            throw error;
        }
    }

    async finishOrder(orderData, clientId = orderData.id) {

        try {
            // Create the order and save the orderId
            const orderId = await this.createOrder(orderData, clientId);

            // Get the order details
            const orderDetails = await this.getOrder(orderId);

            // Get the unpaid_invoice_id
            const unpaidInvoiceId = orderDetails.unpaid_invoice_id;

            await this.updateInvoice(unpaidInvoiceId, orderData.status);

            // Get the invoice details
            const invoiceDetails = await this.getInvoice(unpaidInvoiceId);
            

            // if (orderData.status === 'paid') {
            //     // Mark the invoice as paid in case the order is paid
            //     const data = {
            //         id: unpaidInvoiceId,
            //         transactionId: unpaidInvoiceId,
            //         execute: 1
            //     };
            //     console.log('data:', data)
            //     const response = await this.bbService.callMethod('invoice_mark_as_paid', [data]);
            // }

            console.log(`Order finished in Base64`);
            return invoiceDetails;
        } catch (error) {
            console.error(`Error finishing order: ${error}`);
            throw error;
        }
    }

    async getHooks() {
        try {
            const response = await this.bbService.callMethod('hook_get_list', []);
            return response;
        } catch (error) {
            console.error(`Error getting hooks: ${error}`);
            throw error;
        }
    }

    async batchConnectHooks() {
        try {
            const response = await this.bbService.callMethod('hook_batch_connect', []);
            return response;
        } catch (error) {
            console.error(`Error connecting hooks: ${error}`);
            throw error;
        }
    }
    
    async prepareProduct(productData) {
        // Check if required parameters are provided
        if (!productData.name) {
            throw new Error('name is required');
        }

        const product = {
            title: productData.name,
            type: 'custom',
        };

        try {
            const response = await this.bbService.callMethod('product_prepare', [product]);
            return response;
        } catch (error) {
            console.error(`Error creating product: ${error}`);
            throw error;
        }
    }

    async updateProduct(productData, productId = productData.id) {
        // Check if required parameters are provided
        if (!productId) {
            throw new Error('product_id is required');
        }

        const product = {
            id: productId,
            status: "Enabled"
        };

        try {
            const response = await this.bbService.callMethod('product_update', [product]);
            return response;
        } catch (error) {
            console.error(`Error updating product: ${error}`);
            throw error;
        }
    }

    async createProduct(productData) {
        // Check if required parameters are provided
        
        const productId = await this.prepareProduct(productData);

        await this.updateProduct(productData, productId);

        return productId;
    }

    async getTypes() {
        try {
            const response = await this.bbService.callMethod('product_get_types', []);
            console.log(response);
            return response;
        } catch (error) {
            console.error(`Error getting types: ${error}`);
            throw error;
        }
    }


}

module.exports = admin;