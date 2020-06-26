import React, { Component } from "react";
import {
  View,
  WebView,
  StyleSheet,
  TouchableOpacity,
  Text,
} from "react-native";
import { CreditCardInput } from "react-native-credit-card-input-fullpage";
import uuidv4 from "uuid/v4";
import DeviceInfo from "react-native-device-info";
import sprintfJs from "sprintf-js";
import { Buffer } from "buffer";

const vsprintf = sprintfJs.vsprintf;
let sessionId = uuidv4();
sessionId = sessionId.toUpperCase().replace(/-/g, "");

export const createDeviceSessionId = () => {
  return sessionId;
};

export default class Openpay extends Component {
  constructor(props) {
    super(props);

    if (!this.validateProps(props)) {
      throw new Error("Openpay component requires all the specified props.");
    }

    this.API_URL_SANDBOX = "https://sandbox-api.openpay.mx";
    this.API_URL_PRODUCTION = "https://api.openpay.mx";
    this.state = {
      form: {},
      sessionId: undefined,
      uri: "",
      injectedJavaScript: "",
      loading: false,
    };
  }

  componentDidMount() {
    this.createDeviceSessionId();
  }

  componentWillReceiveProps(nextProps) {
    this.setState(() => ({ loading: nextProps.loading }));
  }

  validateProps = (props) => {
    // Se valida que existan las propiedad requeridas
    if (
      !props.hasOwnProperty("isProductionMode") ||
      !props.hasOwnProperty("load") ||
      !props.hasOwnProperty("merchantId") ||
      !props.hasOwnProperty("publicKey") ||
      !props.hasOwnProperty("successToken") ||
      !props.hasOwnProperty("failToken")
    ) {
      return false;
    }

    // Se validan los tipos de dato
    if (!isBoolean(props.isProductionMode)) {
      return false;
    }

    if (!isString(props.merchantId)) {
      return false;
    }

    if (!isString(props.publicKey)) {
      return false;
    }

    if (!isFunction(props.successToken)) {
      return false;
    }

    if (!isFunction(props.failToken)) {
      return false;
    }

    if (props.hasOwnProperty("address") && !isObject(props.address)) {
      return false;
    }

    return true;
  };

  createDeviceSessionId = () => {
    let identifierForVendor = this.identifierForVendor();
    identifierForVendor = identifierForVendor.replace(/-/g, "");

    const uri = vsprintf("%s/oa/logo.htm?m=%s&s=%s", [
      this.props.isProductionMode
        ? this.API_URL_PRODUCTION
        : this.API_URL_SANDBOX,
      this.props.merchantId,
      sessionId,
    ]);
    const injectedJavaScript = vsprintf('var identifierForVendor = "%s";', [
      identifierForVendor,
    ]);

    this.setState(() => ({ uri, injectedJavaScript }));
    return sessionId;
  };

  createTokenWithCard = async (data) => {
    const method = "POST";
    const resource = "tokens";
    let requestData = data;
    if (this.props.address) {
      requestData.address = this.props.address;
    }

    const response = await this.sendFunction(method, resource, requestData);
    return response;
  };

  sendFunction = (method, resource, data) => {
    const username = this.props.publicKey;
    const url = vsprintf("%s/v1/%s/%s", [
      this.props.isProductionMode
        ? this.API_URL_PRODUCTION
        : this.API_URL_SANDBOX,
      this.props.merchantId,
      resource,
    ]);
    const authorization =
      "Basic " + new Buffer(username + ":").toString("base64");

    return fetch(url, {
      method: method,
      mode: "no-cors",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
      },
      body: JSON.stringify(data),
    })
      .then((response) => response.json()) // parses response to JSON
      .catch((error) => {
        throw error;
      });
  };

  identifierForVendor = () => {
    let deviceSerial = "";
    try {
      deviceSerial = DeviceInfo.getUniqueID();
    } catch (e) {
      console.log("error reading device ID", e);
    }

    return deviceSerial;
  };

  tokenize = async () => {
    this.props.onStart(true);
    console.log("******** tokenize ******");
    this.setState(() => ({ loading: true }));
    const cardForm = this.state.form;

    if (!cardForm.valid) {
      this.props.failToken(cardForm.status);
      this.props.onStart(true);
      this.setState(() => ({ loading: false }));
      this.props.onStart(false);
      return;
    }

    const card = cardForm.values;
    const expirationDate = card.expiry.split("/");
    const requestData = {
      card_number: card.number.replace(/ /g, ""),
      holder_name: card.name,
      cvv2: card.cvc,
      expiration_month: expirationDate[0],
      expiration_year: expirationDate[1],
    };

    try {
      const response = await this.createTokenWithCard(requestData);
      this.props.successToken(response);
      this.setState(() => ({ loading: false }));
    } catch (error) {
      this.props.failToken(error);
      this.setState(() => ({ loading: false }));
      this.props.onStart(false);
    }
  };

  handleCreditCardInputs = (form) => {
    this.setState(() => ({ form }));
  };

  render() {
    const labels = {
      cvc: "CCV",
      expiry: "Expiración",
      name: "Propietario",
      number: "Tarjeta",
    };

    const placeholders = {
      cvc: "CVC",
      expiry: "MM/YY",
      name: "Nombre completo",
      number: "1234 5678 1234 5678",
    };

    const { uri, injectedJavaScript, loading, form } = this.state;

    const Button = ({ loading, onPress }) => (
      <TouchableOpacity
        onPress={onPress}
        style={styles.button}
        disabled={loading || !form.valid}
        // style={{ opacity: loading || !form.valid ? 0.5 : 1}}
      >
        <Text style={styles.text}>
          {" "}
          {this.props.buttonText ? this.props.buttonText : "Pay Now"}
        </Text>
      </TouchableOpacity>
    );

    return (
      <View style={{ flex: 1 }}>
        <CreditCardInput
          onChange={this.handleCreditCardInputs}
          requiresName={true}
          labels={labels}
          placeholders={placeholders}
          inputStyle={styles.inputStyle}
        />
        <Button loading={loading} onPress={this.tokenize} />
        <View style={{ height: 10, width: 10, overflow: "hidden" }}>
          <WebView
            source={{ uri: uri }}
            injectedJavaScript={injectedJavaScript}
          />
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  inputStyle: {
    fontSize: 14,
  },
  container: {
    justifyContent: "center",
    marginTop: 50,
    padding: 20,
    backgroundColor: "#ffffff",
    flex: 1,
  },
  button: {
    height: 45,
    backgroundColor: "#00a6ce",
    justifyContent: "center",
    borderRadius: 8,
    marginTop: 25,
  },
  text: { color: "white", textAlign: "center" },
});

const isFunction = (value) => {
  return typeof value === "function";
};

const isObject = (value) => {
  return value && typeof value === "object" && value.constructor === Object;
};

const isString = (value) => {
  return typeof value === "string" || value instanceof String;
};

const isBoolean = (value) => {
  return typeof value === "boolean";
};

const isNumber = (value) => {
  return typeof value === "number" && isFinite(value);
};

const isNull = (value) => {
  return value === null;
};

// Returns if a value is undefined
const isUndefined = (value) => {
  return typeof value === "undefined";
};
